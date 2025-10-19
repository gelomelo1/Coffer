using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories.Interfaces
{
    public interface IItemTagsRepository
    {
        public Task<List<(string value, List<ItemTags> tags)>> SearchTagsAsync(int collectionTypeId, string searchText);
    }
}
