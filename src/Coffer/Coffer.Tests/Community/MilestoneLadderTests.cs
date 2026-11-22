using Coffer.BusinessLogic.Community.Stats;

namespace Coffer.Tests.Community
{
    /// <summary>Weeks are Monday-based UTC; a met week climbs one rung, a missed (or silent) week steps back one.</summary>
    public class MilestoneLadderTests
    {
        private static readonly int[] Rungs = MilestoneLadder.ItemsAdded;

        [Fact]
        public void WeekStartsMondayUtc()
        {
            Assert.Equal(new DateTime(2026, 11, 16, 0, 0, 0, DateTimeKind.Utc), Weeks.StartOf(new DateTime(2026, 11, 22, 23, 59, 59, DateTimeKind.Utc)));
            Assert.Equal(new DateTime(2026, 11, 23, 0, 0, 0, DateTimeKind.Utc), Weeks.StartOf(new DateTime(2026, 11, 23, 0, 0, 0, DateTimeKind.Utc)));
            Assert.Equal(new DateTime(2026, 11, 16, 0, 0, 0, DateTimeKind.Utc), Weeks.StartOf(new DateTime(2026, 11, 16, 0, 0, 0, DateTimeKind.Utc)));
            Assert.Equal(new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc), Weeks.MonthStartOf(new DateTime(2026, 11, 30, 23, 0, 0, DateTimeKind.Utc)));
        }

        [Fact]
        public void NoHistoryStartsOnFirstRung() =>
            Assert.Equal(new LadderState(0, 0, 0), MilestoneLadder.Replay(Array.Empty<int>(), Rungs));

        [Fact]
        public void MetWeeksClimbOneRungEach() =>
            Assert.Equal(new LadderState(3, 3, 3), MilestoneLadder.Replay(new[] { 10, 15, 25 }, Rungs));

        [Fact]
        public void MissedWeekStepsBackToTheSameValue()
        {
            var state = MilestoneLadder.Replay(new[] { 10, 15, 3 }, Rungs);

            Assert.Equal(new LadderState(1, 0, 2), state);
            Assert.Equal(15, Rungs[state.Rung]);
        }

        [Fact]
        public void SilentWeeksAreMissedWeeks() =>
            Assert.Equal(0, MilestoneLadder.Replay(new[] { 12, 0, 0, 0 }, Rungs).Rung);

        [Fact]
        public void LadderIsCappedAtTheTop()
        {
            var state = MilestoneLadder.Replay(Enumerable.Repeat(100_000, 30).ToArray(), Rungs);

            Assert.Equal(Rungs.Length - 1, state.Rung);
            Assert.Equal(30, state.Streak);
        }

        [Fact]
        public void NeverBelowFirstRung() =>
            Assert.Equal(new LadderState(0, 0, 0), MilestoneLadder.Replay(new[] { 0, 1, 2 }, Rungs));

        [Fact]
        public void LaddersAreStrictlyIncreasing()
        {
            foreach (var ladder in new[] { MilestoneLadder.ItemsAdded, MilestoneLadder.ActiveUsers })
                Assert.True(ladder.Zip(ladder.Skip(1)).All(p => p.First < p.Second));
        }
    }
}
