using System.Net;
using System.Net.Http.Json;
using Coffer.Domain.Community;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Coffer.Tests.Deletion;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>
    /// Every API route must say how it treats an unpublished item type: checked here (called with a hidden type's
    /// collection, item, listing… and must hide or refuse it), checked by a named test, exempt (with the reason), or not
    /// about item types at all. A new route in none of the lists fails, so no endpoint can forget hidden types.
    /// </summary>
    [Collection("api")]
    public class RouteSweepTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private TestDb Db => _api.Db;

        private enum Expect { NotFound, NotSuccess, Absent }

        /// <summary>The hidden type and everything in it; every text marker contains "zz" so leaks are easy to spot.</summary>
        private sealed record Seed(User Owner, User Fan, int TypeId, Guid CollectionId, Guid ItemId, Guid CommentId, Guid ReactionId,
            int AttributeId, Guid PendingId, Guid ListingId, Guid ConversationId);

        private sealed record Check(Func<Seed, User> As, HttpMethod Method, Func<Seed, string> Url, Expect Expect, Func<Seed, HttpContent?>? Body = null);

        private static Check Get(Func<Seed, string> url, Expect expect, bool asFan = false) => new(s => asFan ? s.Fan : s.Owner, HttpMethod.Get, url, expect);
        private static Check Send(HttpMethod method, Func<Seed, string> url, Func<Seed, object?>? body = null, bool asFan = false, Expect expect = Expect.NotSuccess) =>
            new(s => asFan ? s.Fan : s.Owner, method, url, expect, body == null ? null : s => JsonContent.Create(body(s)));

        private static readonly string[] Markers = { "zzhidden" };

        /// <summary>Called by <see cref="CheckedRoutesHideTheHiddenType"/>.</summary>
        private static readonly Dictionary<string, Check> Checked = new()
        {
            ["GET api/CollectionTypes"] = Get(_ => "api/CollectionTypes", Expect.Absent),
            ["GET api/CollectionTypes/{id}"] = Get(s => $"api/CollectionTypes/{s.TypeId}", Expect.NotFound),
            ["GET api/CollectionTypes/Page"] = Get(_ => "api/CollectionTypes/Page", Expect.Absent),
            ["GET api/Attributes"] = Get(_ => "api/Attributes", Expect.Absent),
            ["GET api/Attributes/{id}"] = Get(s => $"api/Attributes/{s.AttributeId}", Expect.NotFound),
            ["GET api/Attributes/Page"] = Get(_ => "api/Attributes/Page", Expect.Absent),
            ["GET api/Collections"] = Get(_ => "api/Collections", Expect.Absent),
            ["GET api/Collections/{id}"] = Get(s => $"api/Collections/{s.CollectionId}", Expect.NotFound),
            ["GET api/Collections/Page"] = Get(_ => "api/Collections/Page", Expect.Absent),
            ["GET api/Collections/Grouped"] = Get(s => $"api/Collections/Grouped?userId={s.Owner.Id}", Expect.Absent),
            ["GET api/Collections/ItemTags/{id}"] = Get(s => $"api/Collections/ItemTags/{s.CollectionId}", Expect.Absent),
            ["GET api/Collections/{collectionId:guid}/Pending"] = Get(s => $"api/Collections/{s.CollectionId}/Pending", Expect.NotFound),
            ["POST api/Collections"] = Send(HttpMethod.Post, _ => "api/Collections", s => new { userId = s.Owner.Id, collectionTypeId = s.TypeId, name = "zzhidden new" }),
            ["PUT api/Collections/{id}"] = Send(HttpMethod.Put, s => $"api/Collections/{s.CollectionId}", s => new { userId = s.Owner.Id, collectionTypeId = s.TypeId, name = "zzhidden renamed" }),
            ["DELETE api/Collections/{id}"] = Send(HttpMethod.Delete, s => $"api/Collections/{s.CollectionId}"),
            ["POST api/Collections/CoverImage/Upload/{id}"] = Send(HttpMethod.Post, s => $"api/Collections/CoverImage/Upload/{s.CollectionId}"),
            ["POST api/Collections/ImageCheck/{id}"] = Send(HttpMethod.Post, s => $"api/Collections/ImageCheck/{s.CollectionId}"),
            ["GET api/Items"] = Get(_ => "api/Items", Expect.Absent),
            ["GET api/Items/{id}"] = Get(s => $"api/Items/{s.ItemId}", Expect.NotFound),
            ["GET api/Items/Page"] = Get(_ => "api/Items/Page", Expect.Absent),
            ["POST api/Items"] = Send(HttpMethod.Post, _ => "api/Items", s => new { collectionId = s.CollectionId, quantity = 1, image = "x", itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() }),
            ["PUT api/Items/{id}"] = Send(HttpMethod.Put, s => $"api/Items/{s.ItemId}", s => new { collectionId = s.CollectionId, quantity = 9, image = "x", itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() }),
            ["DELETE api/Items/{id}"] = Send(HttpMethod.Delete, s => $"api/Items/{s.ItemId}"),
            ["POST api/Items/Upsert"] = Send(HttpMethod.Post, _ => "api/Items/Upsert", s => new[] { new { id = Guid.NewGuid(), item = new { collectionId = s.CollectionId, quantity = 1, image = "x", itemAttributes = Array.Empty<object>(), itemTags = Array.Empty<object>() } } }),
            ["GET api/Items/{itemId:guid}/Comments"] = Get(s => $"api/Items/{s.ItemId}/Comments", Expect.NotFound, asFan: true),
            ["POST api/Items/{itemId:guid}/Comments"] = Send(HttpMethod.Post, s => $"api/Items/{s.ItemId}/Comments", _ => new { body = "zzhidden comment" }, asFan: true, expect: Expect.NotFound),
            ["PUT api/Items/{itemId:guid}/Comments/{commentId:guid}"] = Send(HttpMethod.Put, s => $"api/Items/{s.ItemId}/Comments/{s.CommentId}", _ => new { body = "zzhidden edited" }, asFan: true, expect: Expect.NotFound),
            ["DELETE api/Items/{itemId:guid}/Comments/{commentId:guid}"] = Send(HttpMethod.Delete, s => $"api/Items/{s.ItemId}/Comments/{s.CommentId}", asFan: true, expect: Expect.NotFound),
            ["GET api/Comments/Counts"] = Get(s => $"api/Comments/Counts?itemIds={s.ItemId}", Expect.Absent, asFan: true),
            ["GET api/Feed"] = Get(_ => "api/Feed", Expect.Absent, asFan: true),
            ["GET api/Feed/Search/Items"] = Get(_ => "api/Feed/Search/Items?searchText=zzhidden", Expect.Absent, asFan: true),
            ["GET api/Feed/TagStats"] = Get(_ => "api/Feed/TagStats?search=zzhidden", Expect.Absent, asFan: true),
            ["GET api/Feed/UserFollows"] = Get(_ => "api/Feed/UserFollows", Expect.Absent, asFan: true),
            ["POST api/Follows"] = Send(HttpMethod.Post, _ => "api/Follows", s => new { userId = s.Fan.Id, collectionId = s.CollectionId }, asFan: true, expect: Expect.NotFound),
            ["GET api/Reactions"] = Get(_ => "api/Reactions", Expect.Absent, asFan: true),
            ["GET api/Reactions/{id}"] = Get(s => $"api/Reactions/{s.ReactionId}", Expect.NotFound, asFan: true),
            ["GET api/Reactions/Page"] = Get(_ => "api/Reactions/Page", Expect.Absent, asFan: true),
            ["POST api/Reactions"] = Send(HttpMethod.Post, _ => "api/Reactions", s => new { userId = s.Fan.Id, itemId = s.ItemId, liked = false, rarity = (int?)null }, asFan: true),
            ["GET api/Pending/Summary"] = Get(_ => "api/Pending/Summary", Expect.Absent),
            ["GET api/Pending/Image/{id:guid}"] = Get(s => $"api/Pending/Image/{s.PendingId}", Expect.NotFound),
            ["POST api/Pending/{id:guid}/Add"] = Send(HttpMethod.Post, s => $"api/Pending/{s.PendingId}/Add", s => new { matchItemId = s.ItemId, quantity = 1 }, expect: Expect.NotFound),
            ["GET api/Listings"] = Get(_ => "api/Listings", Expect.Absent, asFan: true),
            ["GET api/Listings/{id:guid}"] = Get(s => $"api/Listings/{s.ListingId}", Expect.NotFound, asFan: true),
            ["GET api/Listings/Mine"] = Get(_ => "api/Listings/Mine", Expect.Absent),
            ["POST api/Listings/{id:guid}/Archive"] = Send(HttpMethod.Post, s => $"api/Listings/{s.ListingId}/Archive", expect: Expect.NotFound),
            ["POST api/Listings/{id:guid}/Reactivate"] = Send(HttpMethod.Post, s => $"api/Listings/{s.ListingId}/Reactivate", expect: Expect.NotFound),
            ["POST api/Listings/{listingId:guid}/Conversations"] = Send(HttpMethod.Post, s => $"api/Listings/{s.ListingId}/Conversations", asFan: true, expect: Expect.NotFound),
            ["POST api/Deals"] = Send(HttpMethod.Post, _ => "api/Deals", s => new { conversationId = s.ConversationId, method = "local_pickup" }, expect: Expect.NotFound),
        };

        /// <summary>Hidden-type behaviour proven by a dedicated test (multipart bodies, Postgres-only search, counts).</summary>
        private static readonly Dictionary<string, string> CheckedElsewhere = new()
        {
            ["DELETE api/Pending/{id:guid}"] = "HiddenTypeCommunityTests.WaitingListOmitsHiddenType (idempotent delete answers 204 like a gone item; the row stays)",
            ["GET api/Listings/Mine/Counts"] = "HiddenTypeMarketTests.BrowseAndMineOmitHiddenListings",
            ["POST api/Listings"] = "HiddenTypeMarketTests.CantCreateOrEditListingOfHiddenType",
            ["PUT api/Listings/{id:guid}"] = "same filtered load as archive (HiddenTypeMarketTests.CantCreateOrEditListingOfHiddenType)",
            ["GET api/Activity"] = "HiddenTypeMarketTests.ActivityEntriesOfHiddenTypeAreUnavailable (entries stay, targets unavailable)",
            ["GET api/Feed/Search"] = "Postgres-only trigram search: base query filtered like Search/Items (device check)",
            ["GET api/Feed/Search/Collections"] = "Postgres-only trigram search: base query filtered (device check)",
            ["GET api/Feed/SearchTag"] = "Postgres-only trigram search: tag base query filtered (device check)",
        };

        private static readonly Dictionary<string, string> Exempt = new()
        {
            ["GET {*path:nonfile}"] = "SPA fallback",
            ["HEAD {*path:nonfile}"] = "SPA fallback",
            ["DELETE api/Account"] = "account deletion works whatever the user's collections are",
            ["GET api/Account/Deletion"] = "account deletion status",
            ["GET api/Account/Suspension"] = "the user's own suspension",
            ["GET api/Activity/Summary"] = "counts of the user's own log; entries stay (targets resolve as unavailable)",
            ["GET api/CollectionTypes/Icon/{fileName}"] = "icon file by exact name; hidden types are listed nowhere",
            ["GET api/Collections/CoverImage/{fileName}"] = "image file by unguessable name; never listed for hidden types",
            ["GET api/Items/CoverImage/{fileName}"] = "image file by unguessable name; never listed for hidden types",
            ["GET api/Items/TempImage/{fileName}"] = "upload temp file by unguessable name",
            ["GET api/Listings/Image/{fileName}"] = "image file by unguessable name; deals in progress still show the listing picture",
            ["GET api/Deals/Image/{fileName}"] = "deal evidence photo; deals in progress keep working",
            ["POST api/Collections/ImageCheck/Test"] = "development test endpoint, no collection",
            ["GET api/ItemOptions"] = "option sets are shared label lists, not owned by a type",
            ["GET api/ItemOptions/{id}"] = "option sets are shared label lists, not owned by a type",
            ["GET api/ItemOptions/Page"] = "option sets are shared label lists, not owned by a type",
            ["GET api/Conversations"] = "existing chats keep working (decision 5)",
            ["GET api/Conversations/{id:guid}"] = "existing chats keep working (decision 5)",
            ["GET api/Conversations/{id:guid}/Messages"] = "existing chats keep working (decision 5)",
            ["POST api/Conversations/{id:guid}/Messages"] = "existing chats keep working (decision 5)",
            ["POST api/Conversations/{id:guid}/Messages/{messageId:guid}/Respond"] = "existing chats keep working (decision 5)",
            ["POST api/Conversations/{id:guid}/Read"] = "existing chats keep working (decision 5)",
            ["GET api/Deals/Mine"] = "deals in progress keep working (decision 5)",
            ["GET api/Deals/{id:guid}"] = "deals in progress keep working (decision 5)",
            ["GET api/Deals/Carriers"] = "carrier list",
            ["POST api/Deals/{id:guid}/Accept"] = "deals in progress keep working (decision 5)",
            ["POST api/Deals/{id:guid}/Decline"] = "deals in progress keep working (decision 5)",
            ["POST api/Deals/{id:guid}/Cancel"] = "deals in progress keep working (decision 5)",
            ["POST api/Deals/{id:guid}/ConfirmHandoff"] = "deals in progress keep working (decision 5)",
            ["POST api/Deals/{id:guid}/Ship"] = "deals in progress keep working (decision 5)",
            ["POST api/Deals/{id:guid}/ConfirmReceipt"] = "deals in progress keep working (decision 5)",
            ["POST api/Deals/{id:guid}/Dispute"] = "deals in progress keep working (decision 5)",
            ["GET api/Deals/{dealId:guid}/Reviews"] = "reviews of trades are the users' record",
            ["POST api/Deals/{dealId:guid}/Reviews"] = "reviews of trades are the users' record",
            ["POST api/Reviews/{id:guid}/Reply"] = "reviews of trades are the users' record",
            ["GET api/Users/{userId:guid}/MarketReviews"] = "reviews of trades are the users' record",
            ["GET api/Users/{userId:guid}/Reputation"] = "reviews of trades are the users' record",
            ["GET api/Market/Badges"] = "counts of the user's chats and deals (exempt above)",
            ["POST api/Reports"] = "reports are accountability: anything already seen can be reported",
            ["GET api/Reports/Mine"] = "the user's own reports",
            ["GET api/Reports/Rules"] = "rule list",
            ["GET api/Moderation/AgainstMe"] = "moderation record of the user",
            ["GET api/Moderation/AgainstMe/UnseenCount"] = "moderation record of the user",
            ["POST api/Moderation/AgainstMe/Seen"] = "moderation record of the user",
        };

        private static readonly HashSet<string> NotTypeRelated = new()
        {
            "GET api/Health", "GET api/Cities/Search", "GET api/Market/Terms", "POST api/Market/Terms/Accept",
            "GET api/Comments/Mentionable",
            "GET api/Users", "GET api/Users/{id}", "GET api/Users/Page", "GET api/Users/UserExists/{username}", "POST api/Users",
            "PUT api/Users/{id}", "PUT api/Users/UserFrontend", "GET api/Feed/Search/Users",
            "GET api/auth/currentUser", "GET api/auth/dev/users", "POST api/auth/dev/login", "POST api/auth/github/register",
            "POST api/auth/github/validate", "POST api/auth/google/register", "POST api/auth/google/validate",
        };

        /// <summary>Manager / admin routes see everything (Manager token + administrator re-check).</summary>
        private static bool IsManager(string route) => route.Contains(" api/Admin/") || route.Contains(" api/Manager/");

        /// <summary>"METHOD pattern" of every controller route.</summary>
        private List<string> Routes() =>
            _api.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
                .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? new[] { "ANY" })
                    .Select(m => $"{m} {e.RoutePattern.RawText}"))
                .Distinct().OrderBy(r => r).ToList();

        [Fact]
        public void EveryRouteIsClassified()
        {
            var unclassified = Routes().Where(r => !IsManager(r) && !Checked.ContainsKey(r) && !CheckedElsewhere.ContainsKey(r)
                && !Exempt.ContainsKey(r) && !NotTypeRelated.Contains(r)).ToList();

            Assert.True(unclassified.Count == 0, "Classify for unpublished item types:\n" + string.Join("\n", unclassified));
        }

        [Fact]
        public void ClassificationListsOnlyExistingRoutes()
        {
            var routes = Routes().ToHashSet();
            var stale = Checked.Keys.Concat(CheckedElsewhere.Keys).Concat(Exempt.Keys).Concat(NotTypeRelated).Where(r => !routes.Contains(r)).ToList();

            Assert.True(stale.Count == 0, "No such route:\n" + string.Join("\n", stale));
        }

        private Seed Plant()
        {
            var owner = Db.AddUser("owner");
            var fan = Db.AddUser("fan");
            var type = Db.AddCollectionType("zzhidden type");
            var attribute = new Attribute { CollectionTypeId = type.Id, Name = "zzhidden brand", Primary = true, Required = true };
            Db.Context.Attributes.Add(attribute);
            Db.Context.SaveChanges();
            var collection = Db.AddCollection(owner, type.Id, "zzhidden collection");
            var item = Db.AddItem(collection);
            item.AcquiredAt = DateTime.UtcNow;
            item.Description = "zzhidden item";
            item.ItemTags.Add(new ItemTags { ItemId = item.Id, Tag = "zzhiddentag" });
            Db.Context.ItemAttributes.Add(new ItemAttribute { ItemId = item.Id, AttributeId = attribute.Id, ValueString = "zzhidden" });
            Db.Follow(fan, collection);
            var reaction = new ReactionProvided(fan.Id, item.Id, true, 4);
            Db.Context.Reactions.Add(reaction);
            var commentId = Guid.NewGuid();
            Db.Context.ItemComments.Add(new ItemComment { Id = commentId, ItemId = item.Id, AuthorId = fan.Id, Body = "zzhidden comment", CreatedAt = DateTime.UtcNow, RootId = commentId });
            var pending = new PendingItem { Id = Guid.NewGuid(), UserId = owner.Id, CollectionId = collection.Id, Quantity = 1, Image = "p.jpg", CreatedAt = DateTime.UtcNow };
            Db.Context.PendingItems.Add(pending);
            Db.Context.SaveChanges();
            var rows = new MarketRows(Db);
            var listing = rows.Listing(owner, title: "zzhidden listing");
            listing.CollectionTypeId = type.Id;
            Db.Context.SaveChanges();
            var chat = rows.Chat(listing, Db.AddUser("buyer")); // an earlier chat (the fan has none, so the fan's would be new)

            type.Published = false;
            Db.Context.SaveChanges();
            return new Seed(owner, fan, type.Id, collection.Id, item.Id, commentId, reaction.Id, attribute.Id, pending.Id, listing.Id, chat.Id);
        }

        [Fact]
        public async Task CheckedRoutesHideTheHiddenType()
        {
            var seed = Plant();
            var failures = new List<string>();

            foreach (var (route, check) in Checked)
            {
                var request = new HttpRequestMessage(check.Method, check.Url(seed)) { Content = check.Body?.Invoke(seed) };
                var response = await _api.ClientFor(check.As(seed)).SendAsync(request);
                var body = await response.Content.ReadAsStringAsync();
                var ok = check.Expect switch
                {
                    Expect.NotFound => response.StatusCode == HttpStatusCode.NotFound,
                    Expect.NotSuccess => !response.IsSuccessStatusCode,
                    Expect.Absent => response.IsSuccessStatusCode && !Markers.Any(m => body.Contains(m, StringComparison.OrdinalIgnoreCase))
                        && !body.Contains(seed.CollectionId.ToString()) && !body.Contains(seed.ItemId.ToString()) && !body.Contains(seed.ListingId.ToString()),
                    _ => false,
                };
                if (!ok) failures.Add($"{route} → {(int)response.StatusCode} (expected {check.Expect}) {body[..Math.Min(body.Length, 160)]}");
            }

            Assert.True(failures.Count == 0, "Hidden item type leaked:\n" + string.Join("\n", failures));

            using var fresh = Db.NewContext();
            Assert.Equal("zzhidden collection", fresh.Collections.Single(c => c.Id == seed.CollectionId).Name);
            Assert.Equal(1, fresh.Collections.Count(c => c.CollectionTypeId == seed.TypeId));
            Assert.Equal(1, fresh.Items.Single(i => i.Id == seed.ItemId).Quantity);
            Assert.Null(fresh.Items.Single(i => i.Id == seed.ItemId).DeletedAt);
            Assert.True(fresh.Reactions.Single(r => r.Id == seed.ReactionId).Liked);
            Assert.Equal("zzhidden comment", fresh.ItemComments.Single(c => c.Id == seed.CommentId).Body);
            Assert.Equal(ListingStatus.Active, fresh.Listings.Single(l => l.Id == seed.ListingId).Status);
            Assert.False(fresh.Deals.Any());
        }

        public void Dispose() => _api.Dispose();
    }
}
