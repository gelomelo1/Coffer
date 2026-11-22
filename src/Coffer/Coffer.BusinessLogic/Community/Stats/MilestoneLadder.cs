namespace Coffer.BusinessLogic.Community.Stats
{
    /// <summary>Community weeks run Monday 00:00 – Sunday 24:00 UTC; months are calendar months (UTC).</summary>
    public static class Weeks
    {
        public static DateTime StartOf(DateTime utc)
        {
            var day = DateTime.SpecifyKind(utc.Date, DateTimeKind.Utc);
            var sinceMonday = ((int)day.DayOfWeek + 6) % 7;
            return day.AddDays(-sinceMonday);
        }

        public static DateTime MonthStartOf(DateTime utc) => new(utc.Year, utc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    }

    /// <summary>Where a milestone stands: the rung of this week's target, met weeks in a row, the best rung ever reached.</summary>
    public sealed record LadderState(int Rung, int Streak, int BestRung);

    /// <summary>
    /// Weekly community goals on a fixed ladder of targets with growing steps. A week that meets its target moves the
    /// next week one rung up; a missed week (a silent week too) moves it one rung down — to exactly the value it had
    /// before. The state is always replayed from the weeks' counts, so it can't drift.
    /// </summary>
    public static class MilestoneLadder
    {
        public static readonly int[] ItemsAdded = { 10, 15, 25, 40, 60, 90, 130, 180, 250, 350, 500, 700, 1000, 1500, 2000, 3000, 5000 };
        public static readonly int[] ActiveUsers = { 3, 5, 8, 12, 18, 25, 35, 50, 75, 100, 150, 200, 300, 500, 750, 1000 };

        /// <param name="completedWeeks">Every completed week's count, oldest first, from the first week with any activity.</param>
        public static LadderState Replay(IReadOnlyList<int> completedWeeks, int[] rungs)
        {
            int rung = 0, streak = 0, best = 0;
            foreach (var count in completedWeeks)
            {
                if (count >= rungs[rung])
                {
                    rung = Math.Min(rung + 1, rungs.Length - 1);
                    streak++;
                }
                else
                {
                    rung = Math.Max(rung - 1, 0);
                    streak = 0;
                }
                best = Math.Max(best, rung);
            }
            return new LadderState(rung, streak, best);
        }
    }
}
