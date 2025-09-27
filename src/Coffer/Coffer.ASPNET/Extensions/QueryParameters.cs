namespace Coffer.ASPNET.Extensions
{
    public class QueryParameters
    {
        public string? Filter { get; set; }
        public string? OrderBy { get; set; }
        public int Page { get; set; } = 1;

        public int PageSize { get; set; } = 20;
    }
}
