using System.Text.Json;
using Coffer.BusinessLogic.DevSeed;
using Coffer.BusinessLogic.Moderation;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Coffer.Domain.Marketplace;
using Microsoft.Extensions.DependencyInjection;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.Tests.DevSeed
{
    /// <summary>Stands in for the Python AI service: "detects" one object per photo by writing a crop + embedding to the temp folder.</summary>
    public sealed class FakeAiPipeline : IAiImagePipeline
    {
        public bool Available { get; set; } = true;
        public List<string> Detected { get; } = new();
        public List<(Guid Collection, Guid TempId, Guid ItemId)> Saved { get; } = new();
        public List<Guid> DeletedCollections { get; } = new();

        public Task<bool> IsAvailableAsync(CancellationToken ct = default) => Task.FromResult(Available);

        public Task<List<Guid>> DetectAsync(string rawImagePath, int collectionTypeId, Guid collectionId, CancellationToken ct = default)
        {
            Detected.Add(Path.GetFileName(rawImagePath));
            var tempId = Guid.NewGuid();
            File.Copy(rawImagePath, Path.Combine(TestEnvironment.Temp, $"{tempId}.jpg"));
            return Task.FromResult(new List<Guid> { tempId });
        }

        public Task SaveEmbeddingsAsync(Guid collectionId, IEnumerable<(Guid TempId, Guid ItemId)> items, CancellationToken ct = default)
        {
            Saved.AddRange(items.Select(i => (collectionId, i.TempId, i.ItemId)));
            return Task.CompletedTask;
        }

        public Task DeleteCollectionEmbeddingsAsync(Guid collectionId, CancellationToken ct = default)
        {
            DeletedCollections.Add(collectionId);
            return Task.CompletedTask;
        }
    }

    // Shares the item image folder with the API tests, so it must not run in parallel with them.
    [Collection("api")]
    public class DevSeedTests : IDisposable
    {
        private static readonly Guid Anna = Guid.Parse("10000000-0000-4000-8000-000000000001");
        private static readonly Guid Bence = Guid.Parse("10000000-0000-4000-8000-000000000002");
        private static readonly Guid CapsOfAnna = Guid.Parse("20000000-0000-4000-8000-000000000001");
        private static readonly Guid EmptyOfBence = Guid.Parse("20000000-0000-4000-8000-000000000002");
        private static readonly Guid Cap1 = Guid.Parse("30000000-0000-4000-8000-000000000001");
        private static readonly Guid Cap2 = Guid.Parse("30000000-0000-4000-8000-000000000002");
        private static readonly Guid Comment1 = Guid.Parse("40000000-0000-4000-8000-000000000001");
        private static readonly Guid Comment2 = Guid.Parse("40000000-0000-4000-8000-000000000002");
        private static readonly Guid Listing1 = Guid.Parse("50000000-0000-4000-8000-000000000001");
        private static readonly Guid Conversation1 = Guid.Parse("60000000-0000-4000-8000-000000000001");
        private static readonly Guid Message1 = Guid.Parse("61000000-0000-4000-8000-000000000001");
        private static readonly Guid Deal1 = Guid.Parse("70000000-0000-4000-8000-000000000001");
        private static readonly Guid Report1 = Guid.Parse("80000000-0000-4000-8000-000000000001");
        private static readonly Guid Report2 = Guid.Parse("80000000-0000-4000-8000-000000000002");

        private readonly TestDb _db = new();
        private readonly FakeAiPipeline _ai = new();
        private readonly string _images = Path.Combine(TestEnvironment.Root, "examples-" + Guid.NewGuid().ToString("N"));
        private readonly IServiceProvider _services;

        public DevSeedTests()
        {
            Directory.CreateDirectory(_images);
            File.WriteAllBytes(Path.Combine(_images, "cap.jpg"), new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3 });
            var type = new CollectionTypeProvided("Cap", "Bottle caps", "#0f0", "cap", new List<Attribute>()) { Published = true };
            _db.Context.CollectionTypes.Add(type);
            _db.Context.SaveChanges();
            _db.Context.Attributes.Add(new Attribute { CollectionTypeId = type.Id, Name = "Brand", DataType = AttributeType.String, Primary = true });
            _db.Context.SaveChanges();
            TypeId = type.Id;
            BrandId = _db.Context.Attributes.Single().Id;

            _services = TestServices.Create(_db, services =>
            {
                services.AddSingleton<IAiImagePipeline>(_ai);
                services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
            });
        }

        private int TypeId { get; }
        private int BrandId { get; }

        private DevSeedData Data() => new()
        {
            Users =
            {
                new SeedUser { Id = Anna, Name = "Anna", Provider = "github", ProviderUserId = "seed-anna" },
                new SeedUser { Id = Bence, Name = "Bence", Provider = "google", ProviderUserId = "seed-bence" },
            },
            Collections =
            {
                new SeedCollection { Id = CapsOfAnna, UserId = Anna, CollectionTypeId = TypeId, Name = "Beer caps" },
                new SeedCollection { Id = EmptyOfBence, UserId = Bence, CollectionTypeId = TypeId, Name = "Empty so far" },
            },
            Items =
            {
                new SeedItem { Id = Cap1, CollectionId = CapsOfAnna, Image = "cap.jpg", Description = "Edelweiss Hefetrüb", Attributes = { new SeedItemAttribute { AttributeId = BrandId, Value = "Edelweiss" } }, Tags = { "beer", "#austria" } },
                new SeedItem { Id = Cap2, CollectionId = CapsOfAnna, Image = "cap.jpg", Quantity = 3 },
            },
            Follows = { new SeedFollow { UserId = Bence, CollectionId = CapsOfAnna } },
            Reactions = { new SeedReaction { UserId = Bence, ItemId = Cap1, Rarity = 4 } },
            Comments =
            {
                new SeedComment { Id = Comment1, ItemId = Cap1, AuthorId = Bence, Body = "@Anna where did you get this? 😍", Mentions = { Anna }, HoursAgo = 5 },
                new SeedComment { Id = Comment2, ItemId = Cap1, AuthorId = Anna, ParentId = Comment1, Body = "In Salzburg!", HoursAgo = 4 },
            },
            Cities = { new SeedCity { ExternalId = 3054643, Name = "Budapest", Latitude = 47.49801, Longitude = 19.03991 } },
            Listings =
            {
                new SeedListing
                {
                    Id = Listing1, OwnerId = Anna, Kind = ListingKind.Sell, CollectionTypeId = TypeId, Title = "Edelweiss cap", PriceCents = 250,
                    CityExternalId = 3054643, Status = ListingStatus.PendingPickup, Lines = { new SeedListingLine { Name = "Edelweiss cap" } }, Images = { "cap.jpg" },
                },
            },
            Conversations =
            {
                new SeedConversation
                {
                    Id = Conversation1, ListingId = Listing1, InquirerId = Bence,
                    Messages =
                    {
                        new SeedMessage { Id = Message1, SenderId = Bence, Body = "Hi, is it still available?", HoursAgo = 30 },
                        new SeedMessage { Id = Guid.NewGuid(), SenderId = Bence, Kind = MessageKind.PriceOffer, AmountCents = 200, Status = ProposalStatus.Accepted, HoursAgo = 29 },
                    },
                },
            },
            Deals =
            {
                new SeedDeal { Id = Deal1, ListingId = Listing1, ConversationId = Conversation1, BuyerId = Bence, Method = DeliveryMethod.LocalPickup,
                    Status = DealStatus.AwaitingHandoff, AgreedPriceCents = 200, MeetupInHours = 20, MeetupPlace = "Deák tér" },
            },
            Reports =
            {
                new SeedReport { Id = Report1, ReporterId = Anna, TargetType = ReportTargetType.Comment, TargetId = Comment1, Rule = ReportRule.Spam, Reason = "This looks like spam to me." },
                new SeedReport { Id = Report2, ReporterId = Bence, TargetType = ReportTargetType.Item, TargetId = Cap2, Rule = ReportRule.OffTopic, Reason = "Three caps in one photo?",
                    Resolution = new SeedResolution { Decision = ReportDecision.NoViolation, Statement = "A multi-cap item is allowed." } },
            },
            Suspensions =
            {
                new SeedSuspension { Id = Guid.NewGuid(), UserId = Bence, Reason = "Old spam wave, already served.", StartedDaysAgo = 30, DurationHours = 24 },
            },
        };

        private DevSeedOptions Options(DevSeedData? data = null, bool enabled = true, bool reset = false, string? imageDir = null) =>
            new(enabled, reset, JsonSerializer.Serialize(data ?? Data(), DevSeedData.Json), imageDir ?? _images, 0);

        private Task RunAsync(DevSeedOptions options, string environment = "Development")
        {
            var scope = _services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<DevSeedRunner>().RunAsync(environment, options);
        }

        [Fact]
        public async Task Seed_InsertsInterconnectedData_ThroughTheRealWorkflows()
        {
            await RunAsync(Options());

            var ctx = _db.NewContext();
            Assert.Equal(new[] { "Anna", "Bence" }, ctx.Users.Select(u => u.Name).OrderBy(n => n).ToArray());
            Assert.All(ctx.Users.ToList(), u => Assert.Equal(UserRole.User, u.Role));
            Assert.Equal(2, ctx.Collections.Count());
            Assert.Equal(2, ctx.Items.Count(i => i.CollectionId == CapsOfAnna));
            Assert.Equal("Edelweiss", ctx.ItemAttributes.Single().ValueString);
            Assert.Equal(new[] { "austria", "beer" }, ctx.ItemTags.Select(t => t.Tag).OrderBy(t => t).ToArray());
            Assert.Single(ctx.Follows);
            Assert.Single(ctx.Reactions);
            Assert.Equal(Comment1, ctx.ItemComments.Single(c => c.Id == Comment2).ParentId);
            Assert.Equal(Anna, ctx.ItemCommentMentions.Single().UserId);
            var deal = ctx.Deals.Single();
            Assert.Equal(DealStatus.AwaitingHandoff, deal.Status);
            Assert.Matches("^[0-9]{4}$", deal.HandoffPin!);
            Assert.Equal(200, ctx.Conversations.Single().AgreedPriceCents);

            // Reports went through the report service (snapshot) and the moderation workflow (resolution).
            var open = ctx.Reports.Single(r => r.Id == Report1);
            Assert.Equal(ReportStatus.Open, open.Status);
            Assert.Contains("where did you get this", open.Snapshot);
            var resolved = ctx.Reports.Single(r => r.Id == Report2);
            Assert.Equal(ReportDecision.NoViolation, resolved.Decision);
            Assert.Equal("A multi-cap item is allowed.", resolved.Statement);
            Assert.Equal("1001", ctx.ManagerAdmins.Single(a => a.Id == resolved.ResolvedBy).GithubId);
            Assert.Equal("expired", (await _services.CreateScope().ServiceProvider.GetRequiredService<ISuspensionService>().ListAsync("all", Bence, 1, 10)).Items.Single().Status);
        }

        [Fact]
        public async Task Seed_ImportsExampleImages_ThroughTheAiPipeline()
        {
            await RunAsync(Options());

            Assert.Equal(new[] { "cap.jpg", "cap.jpg" }, _ai.Detected);
            Assert.Equal(new[] { Cap1, Cap2 }, _ai.Saved.Select(s => s.ItemId).OrderBy(x => x).ToArray());
            var ctx = _db.NewContext();
            foreach (var item in ctx.Items.ToList())
            {
                Assert.StartsWith($"{item.Id}_", item.Image);
                Assert.True(File.Exists(Path.Combine(TestEnvironment.ItemImages, item.Image)));
            }
            var listingImage = ctx.ListingImages.Single();
            Assert.StartsWith($"{listingImage.Id}_", listingImage.FileName);
            Assert.Single(_ai.Detected.Distinct()); // the listing reused the item's AI crop instead of another detection
        }

        [Fact]
        public async Task Seed_WithoutAiService_UsesRawPhotoWithoutEmbedding()
        {
            _ai.Available = false;
            await RunAsync(Options());

            Assert.Empty(_ai.Detected);
            Assert.Empty(_ai.Saved);
            Assert.All(_db.NewContext().Items.ToList(), i => Assert.StartsWith($"{i.Id}_", i.Image));
        }

        [Fact]
        public async Task Seed_MissingImageDirectory_StillSeeds_WithoutPictures()
        {
            await RunAsync(Options(imageDir: Path.Combine(_images, "does-not-exist")));

            var ctx = _db.NewContext();
            Assert.Equal(2, ctx.Items.Count());
            Assert.All(ctx.Items.ToList(), i => Assert.Equal("", i.Image));
            Assert.Empty(_ai.Detected);
        }

        [Fact]
        public async Task ResetDisabled_KeepsExistingData_AndDoesNotSeedTwice()
        {
            var mine = _db.AddUser("my-own-test-user");
            await RunAsync(Options());
            await RunAsync(Options());

            var ctx = _db.NewContext();
            Assert.True(ctx.Users.Any(u => u.Id == mine.Id));
            Assert.Equal(3, ctx.Users.Count());
            Assert.Equal(2, ctx.Reports.Count());
        }

        [Fact]
        public async Task ResetEnabled_WipesUserData_KeepsReferenceData_DeletesOldEmbeddings_ThenReseeds()
        {
            var stranger = _db.AddUser("stranger");
            var strangersCollection = _db.AddCollection(stranger);
            await RunAsync(Options());

            await RunAsync(Options(reset: true));

            var ctx = _db.NewContext();
            Assert.False(ctx.Users.Any(u => u.Id == stranger.Id));
            Assert.Equal(2, ctx.Users.Count());
            Assert.Equal(2, ctx.Reports.Count());
            Assert.Single(ctx.CollectionTypes);
            Assert.Single(ctx.Attributes);
            Assert.Contains(strangersCollection.Id, _ai.DeletedCollections);
            Assert.Contains(CapsOfAnna, _ai.DeletedCollections);
            // Old seed images were removed; only the fresh copies are left.
            Assert.Equal(2, Directory.GetFiles(TestEnvironment.ItemImages).Count(f => Path.GetFileName(f).StartsWith(Cap1.ToString()) || Path.GetFileName(f).StartsWith(Cap2.ToString())));
        }

        [Fact]
        public async Task SeedWithoutReset_RefusesToDuplicateAnExistingLogin()
        {
            var existing = new User("real-anna", "a@example.com", "github", "HU", "seed-anna");
            _db.Context.Users.Add(existing);
            _db.Context.SaveChanges();

            var error = await Assert.ThrowsAsync<DevSeedConfigException>(() => RunAsync(Options()));

            Assert.Contains("real-anna", error.Message);
            Assert.Single(_db.NewContext().Users);
        }

        [Fact]
        public async Task ResetOnly_WithoutSeed_LeavesAnEmptyDatabase()
        {
            _db.AddCollection(_db.AddUser("stranger"));
            await RunAsync(Options(enabled: false, reset: true));

            var ctx = _db.NewContext();
            Assert.Empty(ctx.Users);
            Assert.Empty(ctx.Collections);
            Assert.Single(ctx.CollectionTypes);
        }

        [Theory]
        [InlineData("Production")]
        [InlineData("Staging")]
        public async Task OutsideDevelopment_ResetAndSeed_FailFast_AndTouchNothing(string environment)
        {
            var mine = _db.AddUser("production-user");

            var e1 = await Assert.ThrowsAsync<InvalidOperationException>(() => RunAsync(Options(reset: true), environment));
            var e2 = await Assert.ThrowsAsync<InvalidOperationException>(() => RunAsync(Options(enabled: true), environment));

            Assert.Contains("Development", e1.Message);
            Assert.Contains("Development", e2.Message);
            Assert.True(_db.NewContext().Users.Any(u => u.Id == mine.Id));
            Assert.Single(_db.NewContext().Users);
        }

        [Fact]
        public void Guard_NothingSwitchedOn_IsFineEverywhere()
        {
            DevSeedGuard.Check("Production", new DevSeedOptions(false, false, null, null, 0));
            DevSeedGuard.Check("Development", new DevSeedOptions(true, true, null, null, 0));
        }

        [Fact]
        public async Task InvalidJson_FailsWithClearError_BeforeResetDeletesAnything()
        {
            var mine = _db.AddUser("keep-me");
            var options = new DevSeedOptions(true, true, "{ \"users\": [ { \"id\": 1 } ", _images, 0);

            var error = await Assert.ThrowsAsync<DevSeedConfigException>(() => RunAsync(options));

            Assert.Contains("Not valid seed JSON", error.Message);
            Assert.True(_db.NewContext().Users.Any(u => u.Id == mine.Id));
        }

        [Fact]
        public void Validator_ReportsEveryBrokenReference_WithItsPath()
        {
            var data = Data();
            data.Items[0].CollectionId = Guid.NewGuid();
            data.Comments[1].ParentId = Guid.NewGuid();
            data.Deals[0].Status = DealStatus.Completed;          // listing is pending_pickup, not sold
            data.Reports[0].Rule = ReportRule.Counterfeit;         // doesn't apply to comments
            data.Users.Add(new SeedUser { Id = Anna, Name = "Anna", ProviderUserId = "dup" });

            var reference = new SeedReferenceData(new HashSet<int> { TypeId }, new Dictionary<int, (int, int)> { [BrandId] = (TypeId, 0) });
            var error = Assert.Throws<DevSeedConfigException>(() => DevSeedValidator.Validate(data, reference));

            Assert.Contains(error.Problems, p => p.StartsWith("items[0].collectionId"));
            Assert.Contains(error.Problems, p => p.StartsWith("comments[1].parentId"));
            Assert.Contains(error.Problems, p => p.StartsWith("deals[0]") && p.Contains("sold"));
            Assert.Contains(error.Problems, p => p.StartsWith("reports[0].rule"));
            Assert.Contains(error.Problems, p => p.StartsWith("users[2].id"));
            Assert.Contains(error.Problems, p => p.StartsWith("users[2].name"));
        }

        [Fact]
        public void Parse_RejectsUnknownFieldsAndBadEnums()
        {
            Assert.Throws<DevSeedConfigException>(() => DevSeedValidator.Parse("{\"usres\": []}"));
            Assert.Throws<DevSeedConfigException>(() => DevSeedValidator.Parse("{\"listings\": [{\"kind\": \"rent\"}]}"));
            Assert.Throws<DevSeedConfigException>(() => DevSeedValidator.Parse(""));
        }

        public void Dispose()
        {
            _db.Dispose();
            try { Directory.Delete(_images, true); } catch { }
        }
    }
}
