using System.Text.Json;
using Coffer.BusinessLogic.Activity;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.DataAccess;
using Coffer.Domain.Marketplace;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.Marketplace.Messaging
{
    public interface IConversationService
    {
        Task<ConversationDto> OpenAsync(Guid userId, string subjectType, Guid subjectId);
        Task<List<ConversationSummaryDto>> ListMineAsync(Guid userId);
        /// <summary>The inbox a page at a time (latest activity first); subjectId limits it to chats about one listing.</summary>
        Task<Coffer.Domain.Paging.PagedList<ConversationSummaryDto>> ListMinePageAsync(Guid userId, int? page, int? pageSize, Guid? subjectId = null);
        /// <summary>The newest messages older than <paramref name="before"/> (or the newest overall), oldest first.</summary>
        Task<MessagePageDto> GetMessagesPageAsync(Guid userId, Guid conversationId, DateTime? before, int? pageSize);
        Task<ConversationDto> GetAsync(Guid userId, Guid conversationId);
        Task<List<MessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, DateTime? after);
        Task<MessageDto> PostAsync(Guid userId, Guid conversationId, PostMessageInput input);
        Task<MessageDto> RespondAsync(Guid userId, Guid conversationId, Guid messageId, string action);
        Task MarkReadAsync(Guid userId, Guid conversationId);
        /// <param name="code">market:system.&lt;code&gt; in the app; <paramref name="body"/> is the English text.</param>
        Task PostSystemAsync(Guid conversationId, string code, string body, IReadOnlyDictionary<string, string>? args = null);
        /// <summary>Full transcript. raw = true keeps removed content (admin evidence only).</summary>
        Task<List<MessageDto>> GetTranscriptAsync(Guid conversationId, bool raw = false);
    }

    /// <summary>
    /// Generic two-party conversation engine. Knows nothing about listings: subject-specific rules come from
    /// the registered IConversationSubjectPolicy for the conversation's subject_type.
    /// </summary>
    public class ConversationService : IConversationService
    {
        public const int MaxBody = 2000;
        public const int MaxNote = 500;
        public const int MaxPlace = 120;
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        private readonly CofferDbContext _db;
        private readonly IActivityLog? _activity;
        private readonly IClock _clock;
        private readonly Dictionary<string, IConversationSubjectPolicy> _policies;

        public ConversationService(CofferDbContext db, IClock clock, IEnumerable<IConversationSubjectPolicy> policies, IActivityLog? activity = null)
        {
            _db = db;
            _clock = clock;
            _policies = policies.ToDictionary(p => p.SubjectType);
            _activity = activity;
        }

        private IConversationSubjectPolicy PolicyFor(string subjectType) =>
            _policies.TryGetValue(subjectType ?? "", out var policy) ? policy
            : throw MarketplaceException.Validation("unsupportedConversationSubject", "Unsupported conversation subject.");

        // ------------------------------------------------------------------ conversations

        public async Task<ConversationDto> OpenAsync(Guid userId, string subjectType, Guid subjectId)
        {
            var policy = PolicyFor(subjectType);
            var existing = await _db.Conversations
                .Where(c => c.SubjectType == subjectType && c.SubjectId == subjectId && c.Participants.Any(p => p.UserId == userId))
                .Select(c => (Guid?)c.Id).FirstOrDefaultAsync();
            if (existing.HasValue) return await GetAsync(userId, existing.Value);

            await policy.EnsureCanStartAsync(userId, subjectId);
            var ownerId = await policy.ResolveOwnerAsync(subjectId);
            var now = _clock.UtcNow;
            var conversation = new Conversation
            {
                SubjectType = subjectType,
                SubjectId = subjectId,
                CreatedAt = now,
                LastMessageAt = now,
                Participants =
                {
                    new ConversationParticipant { UserId = ownerId, Role = ParticipantRole.Owner, JoinedAt = now },
                    new ConversationParticipant { UserId = userId, Role = ParticipantRole.Inquirer, JoinedAt = now, LastReadAt = now },
                },
            };
            _db.Conversations.Add(conversation);
            _activity?.Record(userId, "chat.started", ActivityTargetsOf(conversation, userId));
            await _db.SaveChangesAsync();
            return await GetAsync(userId, conversation.Id);
        }

        public async Task<ConversationDto> GetAsync(Guid userId, Guid conversationId)
        {
            var c = await LoadForParticipantAsync(userId, conversationId);
            var me = c.Participants.Single(p => p.UserId == userId);
            var other = c.Participants.Single(p => p.UserId != userId);
            var openDealId = await _db.Deals
                .Where(d => d.ConversationId == c.Id && d.Status != DealStatus.Completed && d.Status != DealStatus.Cancelled && d.Status != DealStatus.Disputed)
                .Select(d => (Guid?)d.Id).FirstOrDefaultAsync();
            var latestDealId = await _db.Deals.Where(d => d.ConversationId == c.Id)
                .OrderByDescending(d => d.CreatedAt).Select(d => (Guid?)d.Id).FirstOrDefaultAsync();
            return new ConversationDto(c.Id, await PolicyFor(c.SubjectType).DescribeAsync(c.SubjectId), me.Role,
                UserSummaryDto.From(other.User), c.AgreedPriceCents, openDealId, c.LastMessageAt, latestDealId);
        }

        public async Task<List<ConversationSummaryDto>> ListMineAsync(Guid userId)
        {
            var conversations = await _db.Conversations.AsNoTracking()
                .Include(c => c.Participants).ThenInclude(p => p.User)
                .Where(c => c.Participants.Any(p => p.UserId == userId))
                .OrderByDescending(c => c.LastMessageAt)
                .ToListAsync();
            return await SummariesAsync(userId, conversations);
        }

        public async Task<Coffer.Domain.Paging.PagedList<ConversationSummaryDto>> ListMinePageAsync(Guid userId, int? page, int? pageSize, Guid? subjectId = null)
        {
            var q = _db.Conversations.AsNoTracking()
                .Include(c => c.Participants).ThenInclude(p => p.User)
                .Where(c => c.Participants.Any(p => p.UserId == userId));
            if (subjectId.HasValue) q = q.Where(c => c.SubjectId == subjectId.Value);
            var conversations = await Coffer.DataAccess.Extensions.PagingExtensions.ToPagedListAsync(q.OrderByDescending(c => c.LastMessageAt).ThenBy(c => c.Id), page, pageSize);
            return new Coffer.Domain.Paging.PagedList<ConversationSummaryDto>(await SummariesAsync(userId, conversations.Items), conversations.Page, conversations.PageSize, conversations.Total);
        }

        private async Task<List<ConversationSummaryDto>> SummariesAsync(Guid userId, List<Conversation> conversations)
        {
            var result = new List<ConversationSummaryDto>();
            foreach (var c in conversations)
            {
                var me = c.Participants.Single(p => p.UserId == userId);
                var other = c.Participants.Single(p => p.UserId != userId);
                var last = await _db.Messages.AsNoTracking().Where(m => m.ConversationId == c.Id)
                    .OrderByDescending(m => m.CreatedAt).FirstOrDefaultAsync();
                var unread = await _db.Messages.CountAsync(m => m.ConversationId == c.Id && m.SenderId != userId
                    && (me.LastReadAt == null || m.CreatedAt > me.LastReadAt));
                SubjectSummaryDto subject;
                try { subject = await PolicyFor(c.SubjectType).DescribeAsync(c.SubjectId); }
                catch (MarketplaceException) { continue; } // subject deleted
                result.Add(new ConversationSummaryDto(c.Id, subject, me.Role, UserSummaryDto.From(other.User),
                    last == null ? null : Preview(last), c.LastMessageAt, unread, last == null ? null : ToDto(last)));
            }
            return result;
        }

        public async Task MarkReadAsync(Guid userId, Guid conversationId)
        {
            var c = await LoadForParticipantAsync(userId, conversationId, tracked: true);
            c.Participants.Single(p => p.UserId == userId).LastReadAt = _clock.UtcNow;
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ messages

        public async Task<List<MessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, DateTime? after)
        {
            await LoadForParticipantAsync(userId, conversationId);
            var q = _db.Messages.AsNoTracking().Where(m => m.ConversationId == conversationId);
            if (after.HasValue)
            {
                var afterUtc = ToUtc(after.Value);
                q = q.Where(m => m.CreatedAt > afterUtc);
            }
            var messages = await q.OrderBy(m => m.CreatedAt).Take(500).ToListAsync();
            return messages.Select(ToDto).ToList();
        }

        public async Task<MessagePageDto> GetMessagesPageAsync(Guid userId, Guid conversationId, DateTime? before, int? pageSize)
        {
            await LoadForParticipantAsync(userId, conversationId);
            var (_, size) = Coffer.Domain.Paging.Paging.Normalize(1, pageSize);
            var all = _db.Messages.AsNoTracking().Where(m => m.ConversationId == conversationId);
            var total = await all.CountAsync();
            var q = all;
            if (before.HasValue)
            {
                var beforeUtc = ToUtc(before.Value);
                q = q.Where(m => m.CreatedAt < beforeUtc);
            }
            var newest = await q.OrderByDescending(m => m.CreatedAt).Take(size + 1).ToListAsync();
            var hasMore = newest.Count > size;
            var page = newest.Take(size).OrderBy(m => m.CreatedAt).Select(ToDto).ToList();
            return new MessagePageDto(page, hasMore, total);
        }

        public async Task<List<MessageDto>> GetTranscriptAsync(Guid conversationId, bool raw = false)
        {
            var messages = await _db.Messages.AsNoTracking().Where(m => m.ConversationId == conversationId)
                .OrderBy(m => m.CreatedAt).ToListAsync();
            return messages.Select(m => raw ? ToRawDto(m) : ToDto(m)).ToList();
        }

        public async Task<MessageDto> PostAsync(Guid userId, Guid conversationId, PostMessageInput input)
        {
            var c = await LoadForParticipantAsync(userId, conversationId, tracked: true);
            EnsureOtherNotDeleted(c, userId);
            var policy = PolicyFor(c.SubjectType);
            await policy.EnsureKindAllowedAsync(c.SubjectId, input.Kind);
            var now = _clock.UtcNow;

            var message = new Message { ConversationId = c.Id, SenderId = userId, Kind = input.Kind, CreatedAt = now };
            switch (input.Kind)
            {
                case MessageKind.Text:
                    message.Body = Text.Required(input.Body, 1, MaxBody, "Message");
                    break;
                case MessageKind.PriceOffer:
                    if (input.AmountCents is null or <= 0 or > 100_000_000)
                        throw MarketplaceException.Validation("offerAmountMustBeAPositiveAmount", "Offer amount must be a positive amount.");
                    message.Body = Text.Optional(input.Body, MaxNote, "Note") ?? "";
                    message.Payload = Serialize(new ProposalPayload { AmountCents = input.AmountCents, Status = ProposalStatus.Pending });
                    await WithdrawPendingAsync(c.Id, userId, MessageKind.PriceOffer);
                    break;
                case MessageKind.MeetupProposal:
                    if (input.At == null) throw MarketplaceException.Validation("pickAMeetupTime", "Pick a meetup time.");
                    var at = ToUtc(input.At.Value);
                    if (at <= now || at > now.AddDays(90))
                        throw MarketplaceException.Validation("meetupTimeMustBeInTheNext", "Meetup time must be in the next 90 days.");
                    var place = Text.Required(input.Place, 1, MaxPlace, "Meetup place");
                    message.Body = Text.Optional(input.Body, MaxNote, "Note") ?? "";
                    message.Payload = Serialize(new ProposalPayload { At = at, Place = place, Status = ProposalStatus.Pending });
                    await WithdrawPendingAsync(c.Id, userId, MessageKind.MeetupProposal);
                    break;
                default:
                    throw MarketplaceException.Validation("unsupportedMessageKind", "Unsupported message kind.");
            }

            _db.Messages.Add(message);
            c.LastMessageAt = now;
            var me = c.Participants.Single(p => p.UserId == userId);
            me.LastReadAt = now;
            if (me.Role == ParticipantRole.Owner && c.OwnerFirstResponseAt == null
                && await _db.Messages.AnyAsync(m => m.ConversationId == c.Id && m.SenderId != null && m.SenderId != userId))
            {
                c.OwnerFirstResponseAt = now;
            }
            // Plain text messages stay out of the log (too noisy); offers and meetup proposals are their own entries.
            if (input.Kind == MessageKind.PriceOffer)
                _activity?.Record(userId, "offer.sent", ActivityTargetsOf(c, userId), new { priceCents = input.AmountCents });
            else if (input.Kind == MessageKind.MeetupProposal)
                _activity?.Record(userId, "meetup.proposed", ActivityTargetsOf(c, userId));
            await _db.SaveChangesAsync();
            return ToDto(message);
        }

        public async Task<MessageDto> RespondAsync(Guid userId, Guid conversationId, Guid messageId, string action)
        {
            var c = await LoadForParticipantAsync(userId, conversationId, tracked: true);
            EnsureOtherNotDeleted(c, userId);
            var message = await _db.Messages.FirstOrDefaultAsync(m => m.Id == messageId && m.ConversationId == c.Id)
                ?? throw MarketplaceException.NotFound("messageNotFound", "Message not found.");
            if (message.IsRemoved) throw MarketplaceException.Conflict("thisMessageWasRemovedByAModerator", "This message was removed by a moderator.");
            if (message.Kind is not (MessageKind.PriceOffer or MessageKind.MeetupProposal))
                throw MarketplaceException.Validation("onlyOffersAndMeetupProposalsCanBe", "Only offers and meetup proposals can be answered.");

            var payload = Deserialize(message.Payload);
            var isSender = message.SenderId == userId;
            var normalized = (action ?? "").Trim().ToLowerInvariant();
            var newStatus = normalized switch
            {
                "accept" => ProposalStatus.Accepted,
                "decline" => ProposalStatus.Declined,
                "withdraw" => ProposalStatus.Withdrawn,
                _ => throw MarketplaceException.Validation("actionMustBeAcceptDeclineOrWithdraw", "Action must be accept, decline or withdraw."),
            };
            if (newStatus == ProposalStatus.Withdrawn && !isSender) throw MarketplaceException.Forbidden("onlyTheSenderCanWithdrawThis", "Only the sender can withdraw this.");
            if (newStatus != ProposalStatus.Withdrawn && isSender) throw MarketplaceException.Forbidden("youCanTAnswerYourOwnProposal", "You can't answer your own proposal.");
            if (payload.Status != ProposalStatus.Pending) throw MarketplaceException.Conflict("thisProposalWasAlreadyAnswered", "This proposal was already answered.");

            if (newStatus == ProposalStatus.Accepted)
            {
                await PolicyFor(c.SubjectType).EnsureKindAllowedAsync(c.SubjectId, message.Kind);
                if (message.Kind == MessageKind.PriceOffer)
                {
                    c.AgreedPriceCents = payload.AmountCents;
                }
                else
                {
                    if (payload.At <= _clock.UtcNow) throw MarketplaceException.Conflict("thisMeetupTimeHasAlreadyPassed", "This meetup time has already passed.");
                    var deal = await _db.Deals.FirstOrDefaultAsync(d => d.ConversationId == c.Id && d.Status != DealStatus.Completed && d.Status != DealStatus.Cancelled && d.Status != DealStatus.Disputed);
                    if (deal != null)
                    {
                        deal.MeetupAt = payload.At;
                        deal.MeetupPlace = payload.Place;
                        deal.UpdatedAt = _clock.UtcNow;
                    }
                }
            }

            payload.Status = newStatus;
            message.Payload = Serialize(payload);
            // Answering an inquirer's offer/meetup is a response too (responsiveness metric).
            if (!isSender && c.OwnerFirstResponseAt == null
                && c.Participants.Single(p => p.UserId == userId).Role == ParticipantRole.Owner)
                c.OwnerFirstResponseAt = _clock.UtcNow;
            _activity?.Record(userId, $"proposal.{newStatus.ToString().ToLowerInvariant()}", ActivityTargetsOf(c, userId),
                new { proposal = message.Kind == MessageKind.PriceOffer ? "offer" : "meetup" });
            await _db.SaveChangesAsync();
            return ToDto(message);
        }

        public async Task PostSystemAsync(Guid conversationId, string code, string body, IReadOnlyDictionary<string, string>? args = null)
        {
            var now = _clock.UtcNow;
            var payload = Serialize(new ProposalPayload { Code = code, Params = args == null ? null : new Dictionary<string, string>(args) });
            _db.Messages.Add(new Message { ConversationId = conversationId, Kind = MessageKind.System, Body = body, Payload = payload, CreatedAt = now });
            var c = await _db.Conversations.FirstOrDefaultAsync(x => x.Id == conversationId);
            if (c != null) c.LastMessageAt = now;
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ helpers

        /// <summary>Nobody would read it: the history stays readable, but a chat with a deleted account takes no new messages.</summary>
        private static ActivityTargets ActivityTargetsOf(Conversation c, Guid userId) => new(
            ConversationId: c.Id,
            ListingId: c.SubjectType == ListingConversationPolicy.Type ? c.SubjectId : null,
            OtherUserId: c.Participants.FirstOrDefault(p => p.UserId != userId)?.UserId);

        private static void EnsureOtherNotDeleted(Conversation c, Guid userId)
        {
            if (c.Participants.Any(p => p.UserId != userId && p.User?.DeletedAt != null))
                throw MarketplaceException.Conflict("otherUserDeleted", "This user deleted their account.");
        }

        private async Task<Conversation> LoadForParticipantAsync(Guid userId, Guid conversationId, bool tracked = false)
        {
            var q = _db.Conversations.Include(c => c.Participants).ThenInclude(p => p.User).AsQueryable();
            if (!tracked) q = q.AsNoTracking();
            return await q.FirstOrDefaultAsync(c => c.Id == conversationId && c.Participants.Any(p => p.UserId == userId))
                ?? throw MarketplaceException.NotFound("conversationNotFound", "Conversation not found.");
        }

        private async Task WithdrawPendingAsync(Guid conversationId, Guid senderId, MessageKind kind)
        {
            var mine = await _db.Messages.Where(m => m.ConversationId == conversationId && m.SenderId == senderId && m.Kind == kind).ToListAsync();
            foreach (var m in mine)
            {
                var p = Deserialize(m.Payload);
                if (p.Status != ProposalStatus.Pending) continue;
                p.Status = ProposalStatus.Withdrawn;
                m.Payload = Serialize(p);
            }
        }

        public const string RemovedBody = "This message was removed by a moderator.";

        private static string Preview(Message m) => m.IsRemoved ? RemovedBody : m.Kind switch
        {
            MessageKind.PriceOffer => "€ Price offer",
            MessageKind.MeetupProposal => "📅 Meetup proposal",
            _ => m.Body.Length > 80 ? m.Body[..80] + "…" : m.Body,
        };

        public static MessageDto ToDto(Message m) => m.IsRemoved
            ? new MessageDto(m.Id, m.SenderId, m.Kind, RemovedBody, null, null, null, null, true, m.CreatedAt)
            : ToRawDto(m);

        public static MessageDto ToRawDto(Message m)
        {
            var p = m.Payload == null ? null : Deserialize(m.Payload);
            if (m.Kind == MessageKind.System)
                return new MessageDto(m.Id, m.SenderId, m.Kind, m.Body, null, null, null, null, m.IsRemoved, m.CreatedAt, p?.Code, p?.Params);
            return new MessageDto(m.Id, m.SenderId, m.Kind, m.Body, p?.AmountCents, p?.At, p?.Place, p?.Status, m.IsRemoved, m.CreatedAt);
        }

        private static string Serialize(ProposalPayload p) => JsonSerializer.Serialize(p, Json);

        private static ProposalPayload Deserialize(string? json) =>
            (json == null ? null : JsonSerializer.Deserialize<ProposalPayload>(json, Json)) ?? new ProposalPayload();

        public static DateTime ToUtc(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
    }
}
