using System.Security.Cryptography;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Messaging;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.BusinessLogic.Marketplace.Terms;
using Coffer.BusinessLogic.Moderation;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using Coffer.Domain.Community;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Domain.Moderation;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Coffer.BusinessLogic.DevSeed
{
    /// <summary>
    /// Inserts the DEV_SEED_DATA_JSON dataset. Plain records are inserted directly; item photos go through the real
    /// AI pipeline and reports go through the real report and moderation services, so the seeded data looks exactly
    /// like data produced by using the app. No seeded user gets an admin role; Manager access stays config-based.
    /// </summary>
    public sealed class DevSeeder
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private readonly CofferDbContext _db;
        private readonly IAiImagePipeline _ai;
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;
        private readonly IReportService _reports;
        private readonly IAdminReportService _adminReports;
        private readonly ManagerAdminConfig _admins;
        private readonly ILogger<DevSeeder> _log;

        public DevSeeder(CofferDbContext db, IAiImagePipeline ai, IImageService images, MarketplaceStorage storage,
            IReportService reports, IAdminReportService adminReports, ManagerAdminConfig admins, ILogger<DevSeeder> log)
        {
            _db = db;
            _ai = ai;
            _images = images;
            _storage = storage;
            _reports = reports;
            _adminReports = adminReports;
            _admins = admins;
            _log = log;
        }

        public async Task<SeedReferenceData> ReferenceDataAsync()
        {
            var types = await _db.CollectionTypes.AsNoTracking().Select(t => t.Id).ToListAsync();
            var attributes = await _db.Attributes.AsNoTracking().Select(a => new { a.Id, a.CollectionTypeId, a.DataType }).ToListAsync();
            return new SeedReferenceData(types.ToHashSet(), attributes.ToDictionary(a => a.Id, a => (a.CollectionTypeId, (int)a.DataType)));
        }

        public async Task<bool> AlreadySeededAsync(DevSeedData data)
        {
            var ids = data.Users.Select(u => u.Id).ToList();
            return await _db.Users.AnyAsync(u => ids.Contains(u.Id));
        }

        /// <summary>Seed users whose login (provider + provider id) already belongs to another account in the database.</summary>
        public async Task<List<string>> LoginConflictsAsync(DevSeedData data)
        {
            var conflicts = new List<string>();
            foreach (var u in data.Users)
            {
                var existing = await _db.Users.AsNoTracking()
                    .Where(x => x.Provider == u.Provider && x.ProviderUserId == u.ProviderUserId && x.Id != u.Id)
                    .Select(x => x.Name).FirstOrDefaultAsync();
                if (existing != null)
                    conflicts.Add($"seed user '{u.Name}' has the same {u.Provider} login as the existing user '{existing}'");
            }
            return conflicts;
        }

        public async Task SeedAsync(DevSeedData data, DevSeedOptions options)
        {
            var now = DateTime.UtcNow;
            DateTime Ago(double days) => now.AddDays(-days);
            _log.LogInformation("Dev seed: inserting {Users} users, {Collections} collections, {Items} items, {Listings} listings, {Deals} deals, {Reports} reports…",
                data.Users.Count, data.Collections.Count, data.Items.Count, data.Listings.Count, data.Deals.Count, data.Reports.Count);

            await using var tx = await _db.Database.BeginTransactionAsync();

            // ---------------------------------------------------------------- people & collections
            foreach (var u in data.Users)
            {
                var user = new User(u.Name, u.Email ?? $"{u.Name.ToLowerInvariant()}@seed.coffer.local", u.Provider, u.Country, u.ProviderUserId, u.Avatar, UserRole.User, u.Summary)
                {
                    Id = u.Id,
                    CreatedAt = Ago(u.CreatedDaysAgo),
                };
                if (u.AcceptMarketTerms)
                {
                    user.MarketTermsVersion = MarketTerms.CurrentVersion;
                    user.MarketTermsAcceptedAt = Ago(Math.Max(0, u.CreatedDaysAgo - 1));
                }
                _db.Users.Add(user);
            }

            foreach (var c in data.Collections)
                _db.Collections.Add(new CollectionProvided(c.UserId, c.CollectionTypeId, c.Name, null, c.Description) { Id = c.Id, CreatedAt = Ago(c.CreatedDaysAgo) });

            var attributeTypes = (await ReferenceDataAsync()).Attributes;
            foreach (var x in data.Items)
            {
                var item = new ItemProvided(x.CollectionId, x.Quantity, "", x.Description, x.PrivateNote) { Id = x.Id, AcquiredAt = Ago(x.AcquiredDaysAgo) };
                _db.Items.Add(item);
                foreach (var a in x.Attributes)
                    _db.ItemAttributes.Add(AttributeValue(x.Id, a, attributeTypes[a.AttributeId].DataType));
                foreach (var tag in x.Tags.Distinct(StringComparer.OrdinalIgnoreCase))
                    _db.ItemTags.Add(new ItemTags { ItemId = x.Id, Tag = tag.Trim().TrimStart('#') });
            }

            foreach (var f in data.Follows)
                _db.Follows.Add(new FollowProvided(f.UserId, f.CollectionId) { Id = Guid.NewGuid(), FollowedAt = Ago(f.DaysAgo) });
            foreach (var r in data.Reactions)
                _db.Reactions.Add(new ReactionProvided(r.UserId, r.ItemId, r.Liked, r.Rarity) { Id = Guid.NewGuid() });
            await _db.SaveChangesAsync();

            // ---------------------------------------------------------------- comments
            foreach (var c in data.Comments)
            {
                var root = c.ParentId == null ? c.Id : _db.ItemComments.Local.First(x => x.Id == c.ParentId).RootId;
                var created = now.AddHours(-c.HoursAgo);
                _db.ItemComments.Add(new ItemComment
                {
                    Id = c.Id,
                    ItemId = c.ItemId,
                    AuthorId = c.AuthorId,
                    ParentId = c.ParentId,
                    RootId = root,
                    Body = c.Body.Replace("\r\n", "\n").Trim(),
                    CreatedAt = created,
                    EditedAt = c.Edited ? created.AddMinutes(12) : null,
                    Mentions = c.Mentions.Distinct().Select(m => new ItemCommentMention { CommentId = c.Id, UserId = m }).ToList(),
                });
            }
            await _db.SaveChangesAsync();

            // ---------------------------------------------------------------- marketplace
            foreach (var city in data.Cities)
            {
                var existing = await _db.Cities.FirstOrDefaultAsync(c => c.ExternalId == city.ExternalId);
                if (existing == null)
                {
                    existing = new City { ExternalId = city.ExternalId };
                    _db.Cities.Add(existing);
                }
                existing.Name = city.Name;
                existing.Admin1 = city.Admin1;
                existing.CountryCode = city.CountryCode;
                existing.Latitude = city.Latitude;
                existing.Longitude = city.Longitude;
            }
            await _db.SaveChangesAsync();
            var cityIds = await _db.Cities.Where(c => data.Cities.Select(x => x.ExternalId).Contains(c.ExternalId)).ToDictionaryAsync(c => c.ExternalId, c => c.Id);

            var listingImages = new List<(ListingImage Image, string Raw)>();
            foreach (var l in data.Listings)
            {
                var listing = new Listing
                {
                    Id = l.Id,
                    OwnerId = l.OwnerId,
                    Kind = l.Kind,
                    CollectionTypeId = l.CollectionTypeId,
                    Title = l.Title,
                    Description = l.Description,
                    PriceCents = l.Kind == ListingKind.Sell ? l.PriceCents : null,
                    ExchangeFor = l.ExchangeFor,
                    Condition = l.Condition,
                    CityId = cityIds[l.CityExternalId],
                    AllowsLocalPickup = l.AllowsLocalPickup,
                    AllowsShipping = l.AllowsShipping,
                    PrivateSellerDeclared = l.Kind != ListingKind.Wanted,
                    Status = l.Status,
                    CreatedAt = Ago(l.CreatedDaysAgo),
                    UpdatedAt = Ago(Math.Max(0, l.CreatedDaysAgo - 0.5)),
                };
                listing.Lines = l.Lines.Select((x, i) => new ListingLine { Id = Guid.NewGuid(), ListingId = l.Id, Name = x.Name, Quantity = x.Quantity, Position = i }).ToList();
                for (var i = 0; i < l.Images.Count; i++)
                {
                    var image = new ListingImage { Id = Guid.NewGuid(), ListingId = l.Id, Position = i, FileName = "" };
                    listing.Images.Add(image);
                    listingImages.Add((image, l.Images[i]));
                }
                _db.Listings.Add(listing);
            }

            foreach (var c in data.Conversations)
            {
                var listing = data.Listings.First(l => l.Id == c.ListingId);
                var ordered = c.Messages.OrderByDescending(m => m.HoursAgo).ToList();
                var first = ordered.Count > 0 ? now.AddHours(-ordered[0].HoursAgo) : now;
                var conversation = new Conversation
                {
                    Id = c.Id,
                    SubjectType = ListingConversationPolicy.Type,
                    SubjectId = c.ListingId,
                    CreatedAt = first.AddMinutes(-1),
                    LastMessageAt = ordered.Count > 0 ? now.AddHours(-ordered[^1].HoursAgo) : now,
                    OwnerFirstResponseAt = ordered.Where(m => m.SenderId == listing.OwnerId).Select(m => (DateTime?)now.AddHours(-m.HoursAgo)).FirstOrDefault(),
                    AgreedPriceCents = ordered.LastOrDefault(m => m.Kind == MessageKind.PriceOffer && m.Status == ProposalStatus.Accepted)?.AmountCents,
                };
                conversation.Participants.Add(new ConversationParticipant { ConversationId = c.Id, UserId = listing.OwnerId, Role = ParticipantRole.Owner, JoinedAt = conversation.CreatedAt, LastReadAt = conversation.LastMessageAt });
                conversation.Participants.Add(new ConversationParticipant { ConversationId = c.Id, UserId = c.InquirerId, Role = ParticipantRole.Inquirer, JoinedAt = conversation.CreatedAt, LastReadAt = conversation.LastMessageAt });
                foreach (var m in ordered)
                {
                    conversation.Messages.Add(new Message
                    {
                        Id = m.Id,
                        ConversationId = c.Id,
                        SenderId = m.SenderId,
                        Kind = m.Kind,
                        Body = m.Body,
                        Payload = m.Kind switch
                        {
                            MessageKind.PriceOffer => JsonSerializer.Serialize(new { amountCents = m.AmountCents, at = (DateTime?)null, place = (string?)null, status = m.Status }, Json),
                            MessageKind.MeetupProposal => JsonSerializer.Serialize(new { amountCents = (int?)null, at = now.AddHours(m.MeetupInHours ?? 24), place = m.Place, status = m.Status }, Json),
                            _ => null,
                        },
                        CreatedAt = now.AddHours(-m.HoursAgo),
                    });
                }
                _db.Conversations.Add(conversation);
            }
            await _db.SaveChangesAsync();

            foreach (var d in data.Deals)
            {
                var listing = data.Listings.First(l => l.Id == d.ListingId);
                var updated = Ago(d.UpdatedDaysAgo);
                var deal = new Deal
                {
                    Id = d.Id,
                    ListingId = d.ListingId,
                    ConversationId = d.ConversationId,
                    SellerId = listing.OwnerId,
                    BuyerId = d.BuyerId,
                    Method = d.Method,
                    Status = d.Status,
                    AgreedPriceCents = d.AgreedPriceCents,
                    MeetupAt = d.MeetupInHours == null ? null : now.AddHours(d.MeetupInHours.Value),
                    MeetupPlace = d.MeetupPlace,
                    HandoffPin = d.Status == DealStatus.AwaitingHandoff ? RandomNumberGenerator.GetInt32(0, 10000).ToString("D4") : null,
                    Carrier = d.Carrier,
                    TrackingNumber = d.TrackingNumber,
                    CreatedAt = Ago(d.CreatedDaysAgo),
                    UpdatedAt = updated,
                };
                switch (d.Status)
                {
                    case DealStatus.Shipped:
                        deal.ShippedAt = updated;
                        break;
                    case DealStatus.Completed:
                        deal.ShippedAt = d.Method == DeliveryMethod.Shipping ? updated.AddDays(-2) : null;
                        deal.ReceivedAt = d.Method == DeliveryMethod.Shipping ? updated : null;
                        deal.CompletedAt = updated;
                        deal.CompletionReason = d.Method == DeliveryMethod.Shipping ? CompletionReason.ReceiptConfirmed : CompletionReason.HandoffVerified;
                        deal.ReviewDeadline = updated.AddDays(14);
                        break;
                    case DealStatus.Disputed:
                        deal.ShippedAt = updated.AddDays(-3);
                        deal.DisputeReason = d.DisputeReason;
                        deal.DisputedAt = updated;
                        deal.ReviewDeadline = updated.AddDays(14);
                        break;
                    case DealStatus.Cancelled:
                        deal.CancelledBy = d.CancelledBy == "seller" ? listing.OwnerId : d.BuyerId;
                        deal.CancelReason = d.CancelReason;
                        break;
                }
                _db.Deals.Add(deal);
            }
            await _db.SaveChangesAsync();

            foreach (var r in data.Reviews)
            {
                var deal = data.Deals.First(x => x.Id == r.DealId);
                var sellerId = data.Listings.First(l => l.Id == deal.ListingId).OwnerId;
                var isBuyer = r.ReviewerId == deal.BuyerId;
                var created = Ago(Math.Max(0, deal.UpdatedDaysAgo - 0.2));
                _db.Reviews.Add(new Review
                {
                    Id = r.Id,
                    DealId = r.DealId,
                    ReviewerId = r.ReviewerId,
                    RevieweeId = isBuyer ? sellerId : deal.BuyerId,
                    ReviewerRole = isBuyer ? ReviewerRole.Buyer : ReviewerRole.Seller,
                    Stars = r.Stars,
                    ReasonTag = r.ReasonTag,
                    Comment = r.Comment,
                    CreatedAt = created,
                    PublishedAt = r.Published ? created.AddHours(2) : null,
                    Reply = r.Published ? r.Reply : null,
                    RepliedAt = r.Published && r.Reply != null ? created.AddHours(5) : null,
                });
            }
            await _db.SaveChangesAsync();

            // ---------------------------------------------------------------- suspensions
            var admin = await SeedAdminAsync(now);
            foreach (var s in data.Suspensions)
            {
                var starts = Ago(s.StartedDaysAgo);
                _db.UserSuspensions.Add(new UserSuspension
                {
                    Id = s.Id,
                    UserId = s.UserId,
                    Reason = s.Reason,
                    StartsAt = starts,
                    EndsAt = starts.AddHours(s.DurationHours),
                    CreatedByAdminId = admin.Id,
                    RevokedAt = s.RevokedDaysAgo == null ? null : Ago(s.RevokedDaysAgo.Value),
                    RevokedByAdminId = s.RevokedDaysAgo == null ? null : admin.Id,
                    RevokeReason = s.RevokeReason,
                    CreatedAt = starts,
                });
            }
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            // ---------------------------------------------------------------- images (files; outside the DB transaction)
            var crops = await ImportItemImagesAsync(data, options);
            await ImportListingImagesAsync(listingImages, options, crops);

            // ---------------------------------------------------------------- reports through the real workflow
            foreach (var r in data.Reports)
            {
                MyReportDto filed;
                try
                {
                    filed = await _reports.CreateAsync(r.ReporterId, new CreateReportInput(r.TargetType, r.TargetId, r.Rule, r.Reason));
                }
                catch (MarketplaceException e)
                {
                    throw new DevSeedConfigException(new[] { $"reports[{data.Reports.IndexOf(r)}] ({r.Id}) was refused by the report rules: {e.Message}" });
                }
                // Keep the configured id (stable references) and move the date back to the configured time.
                var filedAt = Ago(r.DaysAgo);
                await _db.Reports.Where(x => x.Id == filed.Id)
                    .ExecuteUpdateAsync(set => set.SetProperty(x => x.Id, r.Id).SetProperty(x => x.CreatedAt, filedAt));
                _db.ChangeTracker.Clear();

                if (r.Resolution is { } res)
                {
                    try
                    {
                        await _adminReports.ResolveManyAsync(admin.Id, new ResolveReportsInput(new List<Guid> { r.Id }, res.Decision, null, res.Statement, res.SuspensionHours));
                    }
                    catch (MarketplaceException e)
                    {
                        throw new DevSeedConfigException(new[] { $"reports[{data.Reports.IndexOf(r)}].resolution was refused: {e.Message}" });
                    }
                }
            }

            // Author deletions last: deleted comments can still carry reports (tombstones keep them valid).
            foreach (var c in data.Comments.Where(c => c.Deleted))
            {
                var comment = await _db.ItemComments.Include(x => x.Mentions).FirstAsync(x => x.Id == c.Id);
                comment.Body = "";
                comment.DeletedAt = now.AddHours(-c.HoursAgo / 2);
                _db.ItemCommentMentions.RemoveRange(comment.Mentions);
            }
            await _db.SaveChangesAsync();

            _log.LogInformation("Dev seed done.");
        }

        // ------------------------------------------------------------------ images

        private string? RawPath(DevSeedOptions options, string file)
        {
            if (string.IsNullOrWhiteSpace(options.ImageDir)) return null;
            var path = Path.Combine(options.ImageDir, file);
            return File.Exists(path) ? path : null;
        }

        /// <summary>
        /// Each item photo takes the same route as in the app: the raw photo is sent to the AI service, which detects
        /// the object and stores a crop + embedding in the temp folder; the crop becomes the item image and the
        /// embedding is saved under the item id. Without the AI service the raw photo is used and no embedding exists.
        /// </summary>
        /// <returns>Raw photo name → the AI crop made from it (reused for listing photos).</returns>
        private async Task<Dictionary<string, string>> ImportItemImagesAsync(DevSeedData data, DevSeedOptions options)
        {
            var crops = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (data.Items.Count == 0) return crops;
            var itemFolder = Path.Combine(Coffer.BusinessLogic.AppConfig.AppPaths.Images, "items");
            var tempFolder = Coffer.BusinessLogic.AppConfig.AppPaths.Temp;

            if (string.IsNullOrWhiteSpace(options.ImageDir) || !Directory.Exists(options.ImageDir))
            {
                _log.LogWarning("Dev seed: the example image directory '{Dir}' (DEV_SEED_IMAGE_DIR) does not exist — {Count} seeded items have no picture.",
                    options.ImageDir ?? "(not set)", data.Items.Count);
                return crops;
            }

            var aiUp = await WaitForAiAsync(options.AiWaitSeconds);
            if (!aiUp)
                _log.LogWarning("Dev seed: the AI service ({Url}) is not reachable — items get the raw photo and NO embedding, so they won't be found by image search until re-added.",
                    Env.GetString("FASTAPI_URL"));

            var processed = 0;
            foreach (var group in data.Items.GroupBy(i => i.CollectionId))
            {
                var collectionTypeId = data.Collections.First(c => c.Id == group.Key).CollectionTypeId;
                var toEmbed = new List<(Guid TempId, Guid ItemId)>();
                foreach (var seedItem in group)
                {
                    var raw = RawPath(options, seedItem.Image);
                    if (raw == null)
                    {
                        _log.LogWarning("Dev seed: example image '{File}' for item {Id} is missing in {Dir}.", seedItem.Image, seedItem.Id, options.ImageDir);
                        continue;
                    }

                    string fileName;
                    Guid? tempId = null;
                    if (aiUp)
                    {
                        try
                        {
                            var detected = await _ai.DetectAsync(raw, collectionTypeId, group.Key);
                            if (detected.Count > 0) tempId = detected[0];
                            else _log.LogWarning("Dev seed: the AI service found no object on '{File}' (item {Id}); using the raw photo.", seedItem.Image, seedItem.Id);
                        }
                        catch (Exception e)
                        {
                            _log.LogWarning("Dev seed: AI detection failed for '{File}': {Error}; using the raw photo.", seedItem.Image, e.Message);
                        }
                    }

                    fileName = tempId != null
                        ? await _images.CopyImageAsync(seedItem.Id, Path.Combine(tempFolder, tempId.Value.ToString()), itemFolder)
                        : await _images.CopyImageAsync(seedItem.Id, raw, itemFolder);
                    if (tempId != null)
                    {
                        toEmbed.Add((tempId.Value, seedItem.Id));
                        crops.TryAdd(seedItem.Image, Path.Combine(itemFolder, fileName));
                    }

                    var item = await _db.Items.FirstAsync(i => i.Id == seedItem.Id);
                    item.Image = fileName;
                    await _db.SaveChangesAsync();
                }

                if (toEmbed.Count > 0)
                {
                    try
                    {
                        await _ai.SaveEmbeddingsAsync(group.Key, toEmbed);
                        processed += toEmbed.Count;
                    }
                    catch (Exception e)
                    {
                        _log.LogWarning("Dev seed: saving embeddings for collection {Id} failed: {Error}", group.Key, e.Message);
                    }
                }
            }
            _log.LogInformation("Dev seed: {Processed}/{Total} item photos processed by the AI pipeline.", processed, data.Items.Count);
            return crops;
        }

        /// <summary>
        /// Listing photos: the AI crop of the same raw photo when there is one (a few hundred KB, like a photo the app
        /// compresses before upload); otherwise the raw file. Raw phone photos can exceed the app's 8 MB upload limit.
        /// </summary>
        private async Task ImportListingImagesAsync(List<(ListingImage Image, string Raw)> images, DevSeedOptions options, Dictionary<string, string> crops)
        {
            var missing = 0;
            foreach (var (image, rawName) in images)
            {
                var source = crops.TryGetValue(rawName, out var crop) && File.Exists(crop) ? crop : RawPath(options, rawName);
                if (source == null) { missing++; continue; }
                var tracked = await _db.ListingImages.FirstAsync(i => i.Id == image.Id);
                tracked.FileName = await _images.CopyImageAsync(image.Id, source, _storage.ListingImages);
            }
            await _db.SaveChangesAsync();
            if (missing > 0)
                _log.LogWarning("Dev seed: {Count} listing photo(s) were not found in '{Dir}' (DEV_SEED_IMAGE_DIR).", missing, options.ImageDir ?? "(not set)");
        }

        private async Task<bool> WaitForAiAsync(int seconds)
        {
            var until = DateTime.UtcNow.AddSeconds(seconds);
            var announced = false;
            while (true)
            {
                if (await _ai.IsAvailableAsync()) return true;
                if (DateTime.UtcNow >= until) return false;
                if (!announced)
                {
                    _log.LogInformation("Dev seed: waiting up to {Seconds}s for the AI service to start…", seconds);
                    announced = true;
                }
                await Task.Delay(TimeSpan.FromSeconds(3));
            }
        }

        // ------------------------------------------------------------------ helpers

        /// <summary>
        /// Seeded suspensions and resolutions need an acting admin. The first configured GitHub admin is used (so its
        /// row is reused when that person signs in); without configuration a placeholder identity records the seed.
        /// </summary>
        private async Task<ManagerAdmin> SeedAdminAsync(DateTime now)
        {
            var githubId = _admins.Ids.FirstOrDefault() ?? "0";
            var admin = await _db.ManagerAdmins.FirstOrDefaultAsync(a => a.GithubId == githubId);
            if (admin != null) return admin;
            admin = new ManagerAdmin { Id = Guid.NewGuid(), GithubId = githubId, Login = githubId == "0" ? "dev-seed" : "(not signed in yet)", CreatedAt = now, LastLoginAt = now };
            _db.ManagerAdmins.Add(admin);
            await _db.SaveChangesAsync();
            return admin;
        }

        /// <summary>Stores the text value in the attribute's column (AttributeType: 0 string, 1 number, 2 date, 3 boolean, 4–6 option ids as "1;4;").</summary>
        private static ItemAttribute AttributeValue(Guid itemId, SeedItemAttribute a, int dataType)
        {
            var value = new ItemAttribute { ItemId = itemId, AttributeId = a.AttributeId };
            switch (dataType)
            {
                case 1 when int.TryParse(a.Value, out var n):
                    value.ValueNumber = n;
                    break;
                case 2 when DateTime.TryParse(a.Value, out var d):
                    value.ValueDate = DateTime.SpecifyKind(d.Date, DateTimeKind.Utc);
                    break;
                case 3 when bool.TryParse(a.Value, out var b):
                    value.ValueBoolean = b;
                    break;
                default:
                    value.ValueString = a.Value;
                    break;
            }
            return value;
        }
    }
}
