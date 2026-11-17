using Coffer.DataAccess.Extensions.IncludeProviders;
using Coffer.DataAccess.Repositories;
using Coffer.Domain.Entities;

namespace Coffer.Tests.Community
{
    /// <summary>Tag popularity shown while tagging items: distinct items per tag, across the whole app.</summary>
    public class TagStatsTests : IDisposable
    {
        private readonly TestDb _db = new();
        private ItemTagsRepository Repo => new(_db.Context, new ItemIncludeProvider());

        private void Tag(ItemProvided item, params string[] tags)
        {
            foreach (var tag in tags)
                _db.Context.ItemTags.Add(new ItemTags { ItemId = item.Id, Tag = tag });
            _db.Context.SaveChanges();
        }

        private (ItemProvided a, ItemProvided b, ItemProvided c) ThreeItemsOfTwoUsers()
        {
            var anna = _db.AddCollection(_db.AddUser("anna"));
            var bence = _db.AddCollection(_db.AddUser("bence"));
            return (_db.AddItem(anna), _db.AddItem(anna), _db.AddItem(bence));
        }

        [Fact]
        public async Task Counts_DistinctItems_AcrossAllUsersAndCollections()
        {
            var (a, b, c) = ThreeItemsOfTwoUsers();
            Tag(a, "austria", "travel");
            Tag(b, "austria");
            Tag(c, "austria", "beer");

            var stats = await Repo.GetTagStatsAsync(null, new[] { "austria", "beer" });

            Assert.Equal(3, stats.Single(s => s.Tag == "austria").ItemCount);
            Assert.Equal(1, stats.Single(s => s.Tag == "beer").ItemCount);
        }

        [Fact]
        public async Task ExactLookup_ReturnsZero_ForUnusedTags_AndNormalizesInput()
        {
            var (a, _, _) = ThreeItemsOfTwoUsers();
            Tag(a, "austria");

            var stats = await Repo.GetTagStatsAsync(null, new[] { " #Austria ", "brandnew" });

            Assert.Equal(new[] { ("austria", 1), ("brandnew", 0) }, stats.Select(s => (s.Tag, s.ItemCount)).ToArray());
        }

        [Fact]
        public async Task Search_MatchesPartialText_MostUsedFirst_ThenAlphabetical()
        {
            var (a, b, c) = ThreeItemsOfTwoUsers();
            Tag(a, "austria", "australia");
            Tag(b, "austria");
            Tag(c, "austrian", "beer");

            var stats = await Repo.GetTagStatsAsync("#AUST", null);

            Assert.Equal(new[] { ("austria", 2), ("australia", 1), ("austrian", 1) }, stats.Select(s => (s.Tag, s.ItemCount)).ToArray());
        }

        [Fact]
        public async Task Search_WithoutText_ReturnsNothing()
        {
            var (a, _, _) = ThreeItemsOfTwoUsers();
            Tag(a, "austria");

            Assert.Empty(await Repo.GetTagStatsAsync("  ", null));
        }

        public void Dispose() => _db.Dispose();
    }
}
