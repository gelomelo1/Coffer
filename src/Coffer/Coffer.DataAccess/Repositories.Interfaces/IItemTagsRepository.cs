using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    /// <summary>How many distinct items use a tag, across the whole app.</summary>
    public record TagStat(string Tag, int ItemCount);

    public interface IItemTagsRepository
    {
        /// <summary>
        /// Tag popularity: with <paramref name="tags"/> the counts of exactly those tags (0 when unused, in the given
        /// order); otherwise the 8 most used tags containing <paramref name="search"/>. Input is normalized
        /// (trimmed, lowercase, without '#').
        /// </summary>
        public Task<List<TagStat>> GetTagStatsAsync(string? search, IReadOnlyCollection<string>? tags);
        public Task<Coffer.Domain.Paging.PagedList<(string value, List<ItemTags> tags)>> SearchTagsSmartAsync(string? collectionTypeIds, string searchText, int? page, int? pageSize);
        public Task<List<(string value, List<ItemTags> tags)>> SearchTagsAsync(string? collectionTypeIds, string searchText);
    }
}
