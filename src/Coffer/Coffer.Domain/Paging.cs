namespace Coffer.Domain.Paging
{
    /// <summary>One page of a list plus the total count for the same filters. The app appends pages as the user scrolls.</summary>
    public sealed record PagedList<T>(List<T> Items, int Page, int PageSize, int Total);

    /// <summary>A page of a list ordered by group (collection type) first; GroupCounts has the total per group id.</summary>
    public sealed record GroupedPagedList<T>(List<T> Items, int Page, int PageSize, int Total, Dictionary<int, int> GroupCounts);

    public static class Paging
    {
        public const int DefaultSize = 20;
        public const int MaxSize = 50;

        /// <summary>Page from 1; size defaults to 20 and is capped at 50 so one request can't ask for everything.</summary>
        public static (int Page, int PageSize) Normalize(int? page, int? pageSize) =>
            (Math.Max(1, page ?? 1), pageSize is null or <= 0 ? DefaultSize : Math.Min(pageSize.Value, MaxSize));

        public static int Skip(int page, int pageSize) => (page - 1) * pageSize;
    }
}
