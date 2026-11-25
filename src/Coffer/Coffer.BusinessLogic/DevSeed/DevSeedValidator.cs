using System.Text.Json;
using Coffer.BusinessLogic.Community;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Marketplace.Reports;
using Coffer.Domain.Marketplace;

namespace Coffer.BusinessLogic.DevSeed
{
    public sealed class DevSeedConfigException : Exception
    {
        public IReadOnlyList<string> Problems { get; }

        public DevSeedConfigException(IReadOnlyList<string> problems)
            : base("DEV_SEED_DATA_JSON is invalid:\n  - " + string.Join("\n  - ", problems))
        {
            Problems = problems;
        }
    }

    /// <summary>Reference data that must already exist in the database (seeding never invents collection types).</summary>
    public sealed record SeedReferenceData(IReadOnlySet<int> CollectionTypeIds, IReadOnlyDictionary<int, (int CollectionTypeId, int DataType)> Attributes);

    /// <summary>
    /// Parses and checks DEV_SEED_DATA_JSON before anything is written: syntax, required fields, duplicate ids,
    /// references between records, enum values and the business rules seeded states must respect.
    /// Every problem is reported with its JSON path.
    /// </summary>
    public static class DevSeedValidator
    {
        public static DevSeedData Parse(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
                throw new DevSeedConfigException(new[] { "DEV_SEED_DATA_JSON is empty. Put the seed data (users, collections, items, …) into src/.env." });
            try
            {
                return JsonSerializer.Deserialize<DevSeedData>(json.Trim(), DevSeedData.Json)
                    ?? throw new DevSeedConfigException(new[] { "DEV_SEED_DATA_JSON is null." });
            }
            catch (JsonException e)
            {
                var where = e.Path is { Length: > 0 } ? $" at {e.Path}" : "";
                var line = e.LineNumber is long l ? $" (line {l + 1})" : "";
                throw new DevSeedConfigException(new[] { $"Not valid seed JSON{where}{line}: {e.Message.Split(" Path:")[0]}" });
            }
        }

        public static void Validate(DevSeedData d, SeedReferenceData reference)
        {
            var p = new List<string>();

            var users = Unique(p, "users", d.Users, u => u.Id);
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var logins = new HashSet<string>();
            for (var i = 0; i < d.Users.Count; i++)
            {
                var u = d.Users[i];
                var at = $"users[{i}]";
                if (string.IsNullOrWhiteSpace(u.Name) || u.Name.Length > 50) p.Add($"{at}.name is required (max 50 characters).");
                else if (!names.Add(u.Name)) p.Add($"{at}.name '{u.Name}' is used twice.");
                if (u.Provider is not ("google" or "facebook" or "discord" or "github")) p.Add($"{at}.provider must be one of \"google\", \"facebook\", \"discord\", \"github\".");
                if (string.IsNullOrWhiteSpace(u.ProviderUserId)) p.Add($"{at}.providerUserId is required.");
                else if (!logins.Add($"{u.Provider}:{u.ProviderUserId}")) p.Add($"{at}.providerUserId is used by two users.");
                if (string.IsNullOrWhiteSpace(u.Country) || u.Country.Length > 56) p.Add($"{at}.country is required.");
            }

            var collections = Unique(p, "collections", d.Collections, c => c.Id);
            for (var i = 0; i < d.Collections.Count; i++)
            {
                var c = d.Collections[i];
                var at = $"collections[{i}]";
                Ref(p, users, c.UserId, $"{at}.userId", "user");
                if (!reference.CollectionTypeIds.Contains(c.CollectionTypeId)) p.Add($"{at}.collectionTypeId {c.CollectionTypeId} does not exist.");
                if (string.IsNullOrWhiteSpace(c.Name) || c.Name.Length > 100) p.Add($"{at}.name is required (max 100 characters).");
            }

            var items = Unique(p, "items", d.Items, x => x.Id);
            for (var i = 0; i < d.Items.Count; i++)
            {
                var x = d.Items[i];
                var at = $"items[{i}]";
                var collection = Ref(p, collections, x.CollectionId, $"{at}.collectionId", "collection");
                if (string.IsNullOrWhiteSpace(x.Image)) p.Add($"{at}.image is required (a raw photo in DEV_SEED_IMAGE_DIR).");
                else if (x.Image.IndexOfAny(new[] { '/', '\\' }) >= 0) p.Add($"{at}.image must be a plain file name.");
                if (x.Quantity < 1) p.Add($"{at}.quantity must be at least 1.");
                var seenAttributes = new HashSet<int>();
                for (var a = 0; a < x.Attributes.Count; a++)
                {
                    var attr = x.Attributes[a];
                    if (!reference.Attributes.TryGetValue(attr.AttributeId, out var def)) p.Add($"{at}.attributes[{a}].attributeId {attr.AttributeId} does not exist.");
                    else if (collection != null && def.CollectionTypeId != collection.CollectionTypeId) p.Add($"{at}.attributes[{a}] belongs to another collection type.");
                    if (!seenAttributes.Add(attr.AttributeId)) p.Add($"{at}.attributes[{a}] repeats attribute {attr.AttributeId}.");
                }
                if (x.Tags.Any(string.IsNullOrWhiteSpace)) p.Add($"{at}.tags must not contain empty tags.");
            }

            var follows = new HashSet<(Guid, Guid)>();
            for (var i = 0; i < d.Follows.Count; i++)
            {
                var f = d.Follows[i];
                Ref(p, users, f.UserId, $"follows[{i}].userId", "user");
                Ref(p, collections, f.CollectionId, $"follows[{i}].collectionId", "collection");
                if (!follows.Add((f.UserId, f.CollectionId))) p.Add($"follows[{i}] is a duplicate.");
            }

            var reactions = new HashSet<(Guid, Guid)>();
            for (var i = 0; i < d.Reactions.Count; i++)
            {
                var r = d.Reactions[i];
                Ref(p, users, r.UserId, $"reactions[{i}].userId", "user");
                Ref(p, items, r.ItemId, $"reactions[{i}].itemId", "item");
                if (r.Rarity is < 1 or > 5) p.Add($"reactions[{i}].rarity must be 1–5.");
                if (!reactions.Add((r.UserId, r.ItemId))) p.Add($"reactions[{i}] is a duplicate.");
            }

            var comments = Unique(p, "comments", d.Comments, c => c.Id);
            var commentOrder = new Dictionary<Guid, int>();
            for (var i = 0; i < d.Comments.Count; i++)
            {
                var c = d.Comments[i];
                var at = $"comments[{i}]";
                Ref(p, items, c.ItemId, $"{at}.itemId", "item");
                Ref(p, users, c.AuthorId, $"{at}.authorId", "user");
                if (c.ParentId is Guid parentId)
                {
                    if (!commentOrder.ContainsKey(parentId)) p.Add($"{at}.parentId must point to a comment listed before it.");
                    else if (comments.TryGetValue(parentId, out var parent) && parent.ItemId != c.ItemId) p.Add($"{at} must belong to the same item as its parent.");
                }
                Try(p, $"{at}.body", () => ItemCommentService.CleanBody(c.Body));
                foreach (var m in c.Mentions)
                {
                    var mentioned = Ref(p, users, m, $"{at}.mentions", "user");
                    if (mentioned != null && !ItemCommentService.ContainsMention(c.Body, mentioned.Name))
                        p.Add($"{at}.mentions: the body does not contain \"@{mentioned.Name}\".");
                }
                commentOrder[c.Id] = i;
            }

            var cities = new Dictionary<long, SeedCity>();
            for (var i = 0; i < d.Cities.Count; i++)
            {
                var c = d.Cities[i];
                if (string.IsNullOrWhiteSpace(c.Name)) p.Add($"cities[{i}].name is required.");
                if (c.Latitude is < -90 or > 90 || c.Longitude is < -180 or > 180) p.Add($"cities[{i}] has invalid coordinates.");
                if (!cities.TryAdd(c.ExternalId, c)) p.Add($"cities[{i}].externalId {c.ExternalId} is used twice.");
            }

            var listings = Unique(p, "listings", d.Listings, l => l.Id);
            for (var i = 0; i < d.Listings.Count; i++)
            {
                var l = d.Listings[i];
                var at = $"listings[{i}]";
                Ref(p, users, l.OwnerId, $"{at}.ownerId", "user");
                if (!reference.CollectionTypeIds.Contains(l.CollectionTypeId)) p.Add($"{at}.collectionTypeId {l.CollectionTypeId} does not exist.");
                if (!cities.ContainsKey(l.CityExternalId)) p.Add($"{at}.cityExternalId {l.CityExternalId} is not in \"cities\".");
                if (string.IsNullOrWhiteSpace(l.Title) || l.Title.Length > 100) p.Add($"{at}.title is required (max 100 characters).");
                if (l.Kind == ListingKind.Sell && l.PriceCents is null or <= 0) p.Add($"{at}: a sell listing needs priceCents.");
                if (l.Kind == ListingKind.Exchange && string.IsNullOrWhiteSpace(l.ExchangeFor)) p.Add($"{at}: an exchange listing needs exchangeFor.");
                if (!l.AllowsLocalPickup && !l.AllowsShipping) p.Add($"{at} must allow local pickup or shipping.");
                if (l.Lines.Count == 0) p.Add($"{at}.lines needs at least one entry (what's included).");
                if (l.Lines.Any(x => string.IsNullOrWhiteSpace(x.Name) || x.Quantity < 1)) p.Add($"{at}.lines entries need a name and quantity ≥ 1.");
                if (l.Images.Count == 0) p.Add($"{at}.images needs at least one photo.");
            }

            var conversations = Unique(p, "conversations", d.Conversations, c => c.Id);
            var messages = new Dictionary<Guid, (SeedMessage Message, SeedConversation Conversation)>();
            for (var i = 0; i < d.Conversations.Count; i++)
            {
                var c = d.Conversations[i];
                var at = $"conversations[{i}]";
                var listing = Ref(p, listings, c.ListingId, $"{at}.listingId", "listing");
                Ref(p, users, c.InquirerId, $"{at}.inquirerId", "user");
                if (listing != null && listing.OwnerId == c.InquirerId) p.Add($"{at}: the inquirer can't be the listing owner.");
                for (var m = 0; m < c.Messages.Count; m++)
                {
                    var msg = c.Messages[m];
                    var mat = $"{at}.messages[{m}]";
                    if (msg.Id == Guid.Empty) p.Add($"{mat}.id is required.");
                    else if (!messages.TryAdd(msg.Id, (msg, c))) p.Add($"{mat}.id {msg.Id} is used twice.");
                    if (msg.SenderId is Guid sender && listing != null && sender != listing.OwnerId && sender != c.InquirerId)
                        p.Add($"{mat}.senderId must be the listing owner or the inquirer.");
                    if (msg.SenderId == null && msg.Kind != MessageKind.System) p.Add($"{mat}: only system messages have no sender.");
                    if (msg.Kind == MessageKind.PriceOffer && (msg.AmountCents is null or <= 0 || msg.Status == null)) p.Add($"{mat}: a price offer needs amountCents and status.");
                    if (msg.Kind == MessageKind.MeetupProposal && (msg.MeetupInHours == null || string.IsNullOrWhiteSpace(msg.Place) || msg.Status == null))
                        p.Add($"{mat}: a meetup proposal needs meetupInHours, place and status.");
                    if (msg.Kind is MessageKind.Text or MessageKind.System && string.IsNullOrWhiteSpace(msg.Body)) p.Add($"{mat}.body is required.");
                }
            }

            var deals = Unique(p, "deals", d.Deals, x => x.Id);
            var openPerListing = new HashSet<Guid>();
            for (var i = 0; i < d.Deals.Count; i++)
            {
                var x = d.Deals[i];
                var at = $"deals[{i}]";
                var listing = Ref(p, listings, x.ListingId, $"{at}.listingId", "listing");
                var conversation = Ref(p, conversations, x.ConversationId, $"{at}.conversationId", "conversation");
                Ref(p, users, x.BuyerId, $"{at}.buyerId", "user");
                if (conversation != null && (conversation.ListingId != x.ListingId || conversation.InquirerId != x.BuyerId))
                    p.Add($"{at}: the conversation must be about the same listing and the buyer must be its inquirer.");
                if (listing == null) continue;
                if (x.Method == DeliveryMethod.LocalPickup && !listing.AllowsLocalPickup) p.Add($"{at}: the listing doesn't allow local pickup.");
                if (x.Method == DeliveryMethod.Shipping && !listing.AllowsShipping) p.Add($"{at}: the listing doesn't allow shipping.");
                if (DealStatuses.IsOpen(x.Status) && !openPerListing.Add(x.ListingId)) p.Add($"{at}: a listing can have only one open deal.");
                var expected = ExpectedListingStatus(x);
                if (expected != null && listing.Status != expected) p.Add($"{at}: a {EnumText.ToSnake(x.Status)} deal needs its listing to be {EnumText.ToSnake(expected.Value)}.");
                if (x.Status is DealStatus.Shipped && string.IsNullOrWhiteSpace(x.TrackingNumber)) p.Add($"{at}: a shipped deal needs carrier and trackingNumber.");
                if (x.Status is DealStatus.Disputed && string.IsNullOrWhiteSpace(x.DisputeReason)) p.Add($"{at}: a disputed deal needs disputeReason.");
                if (x.Status is DealStatus.Cancelled && x.CancelledBy is not ("buyer" or "seller")) p.Add($"{at}.cancelledBy must be \"buyer\" or \"seller\".");
                if (x.Status is DealStatus.AwaitingHandoff && x.MeetupInHours == null) p.Add($"{at}: a pickup deal awaiting handoff needs meetupInHours.");
            }

            var reviews = Unique(p, "reviews", d.Reviews, r => r.Id);
            var reviewPairs = new HashSet<(Guid, Guid)>();
            for (var i = 0; i < d.Reviews.Count; i++)
            {
                var r = d.Reviews[i];
                var at = $"reviews[{i}]";
                var deal = Ref(p, deals, r.DealId, $"{at}.dealId", "deal");
                if (deal != null)
                {
                    var listing = listings.GetValueOrDefault(deal.ListingId);
                    if (deal.Status is not (DealStatus.Completed or DealStatus.Disputed)) p.Add($"{at}: only completed or disputed deals can be reviewed.");
                    if (listing != null && r.ReviewerId != deal.BuyerId && r.ReviewerId != listing.OwnerId) p.Add($"{at}.reviewerId must be the buyer or the seller.");
                }
                if (!reviewPairs.Add((r.DealId, r.ReviewerId))) p.Add($"{at}: one review per person per deal.");
                if (r.Stars is < 1 or > 5) p.Add($"{at}.stars must be 1–5.");
                if (r.Stars <= 2 && (r.ReasonTag == null || (r.Comment?.Trim().Length ?? 0) < 20)) p.Add($"{at}: 1–2 stars need reasonTag and a comment of at least 20 characters.");
            }

            var reports = Unique(p, "reports", d.Reports, r => r.Id);
            for (var i = 0; i < d.Reports.Count; i++)
            {
                var r = d.Reports[i];
                var at = $"reports[{i}]";
                Ref(p, users, r.ReporterId, $"{at}.reporterId", "user");
                var exists = r.TargetType switch
                {
                    ReportTargetType.Listing => listings.ContainsKey(r.TargetId),
                    ReportTargetType.Message => messages.ContainsKey(r.TargetId),
                    ReportTargetType.Review => reviews.ContainsKey(r.TargetId),
                    ReportTargetType.Item => items.ContainsKey(r.TargetId),
                    ReportTargetType.Comment => comments.ContainsKey(r.TargetId),
                    _ => false,
                };
                if (!exists) p.Add($"{at}.targetId is not a seeded {EnumText.ToSnake(r.TargetType)}.");
                if (!ReportRules.Applies(r.Rule, r.TargetType)) p.Add($"{at}.rule {EnumText.ToSnake(r.Rule)} doesn't apply to a {EnumText.ToSnake(r.TargetType)}.");
                if ((r.Reason?.Trim().Length ?? 0) < ReportService.MinReason) p.Add($"{at}.reason needs at least {ReportService.MinReason} characters.");
                if (r.Resolution is { } res)
                {
                    if ((res.Statement?.Trim().Length ?? 0) < 10) p.Add($"{at}.resolution.statement needs at least 10 characters.");
                    if (res.Decision == ReportDecision.Suspended && res.SuspensionHours == null) p.Add($"{at}.resolution: suspended needs suspensionHours.");
                    if (res.Decision == ReportDecision.NoViolation && res.SuspensionHours != null) p.Add($"{at}.resolution: no_violation can't suspend.");
                    if (r.TargetType == ReportTargetType.Item && res.Decision == ReportDecision.Removed)
                        p.Add($"{at}.resolution: seeded item reports can't be resolved as removed (that deletes a seeded item).");
                }
            }

            Unique(p, "suspensions", d.Suspensions, s => s.Id);
            for (var i = 0; i < d.Suspensions.Count; i++)
            {
                var s = d.Suspensions[i];
                Ref(p, users, s.UserId, $"suspensions[{i}].userId", "user");
                if ((s.Reason?.Trim().Length ?? 0) < 10) p.Add($"suspensions[{i}].reason needs at least 10 characters.");
                if (s.DurationHours <= 0) p.Add($"suspensions[{i}].durationHours must be positive.");
                if (s.RevokedDaysAgo != null && string.IsNullOrWhiteSpace(s.RevokeReason)) p.Add($"suspensions[{i}]: a revoked suspension needs revokeReason.");
            }

            if (p.Count > 0) throw new DevSeedConfigException(p);
        }

        public static ListingStatus? ExpectedListingStatus(SeedDeal deal) => deal.Status switch
        {
            DealStatus.Proposed => ListingStatus.Active,
            DealStatus.AwaitingHandoff => ListingStatus.PendingPickup,
            DealStatus.AwaitingShipment or DealStatus.Shipped => ListingStatus.PendingShipment,
            DealStatus.Completed => ListingStatus.Sold,
            DealStatus.Disputed => ListingStatus.Archived,
            _ => null,
        };

        private static Dictionary<Guid, T> Unique<T>(List<string> problems, string section, List<T> list, Func<T, Guid> id)
        {
            var map = new Dictionary<Guid, T>();
            for (var i = 0; i < list.Count; i++)
            {
                var key = id(list[i]);
                if (key == Guid.Empty) problems.Add($"{section}[{i}].id is required.");
                else if (!map.TryAdd(key, list[i])) problems.Add($"{section}[{i}].id {key} is used twice.");
            }
            return map;
        }

        private static T? Ref<T>(List<string> problems, Dictionary<Guid, T> map, Guid id, string path, string what) where T : class
        {
            if (map.TryGetValue(id, out var found)) return found;
            problems.Add($"{path} {id} is not a seeded {what}.");
            return null;
        }

        private static void Try(List<string> problems, string path, Action check)
        {
            try { check(); }
            catch (MarketplaceException e) { problems.Add($"{path}: {e.Message}"); }
        }
    }
}
