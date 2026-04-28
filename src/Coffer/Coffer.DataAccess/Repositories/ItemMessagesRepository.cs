using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess.Repositories
{
    public class ItemMessagesRepository : IItemMessagesRepository
    {
        private readonly CofferDbContext _context;

        public ItemMessagesRepository(CofferDbContext context)
        {
            _context = context;
        }

        public async Task<int> GetMessageCountByItemIdAsync(Guid itemId)
        {
            return await _context.ItemMessages
                .Where(m => m.ItemId == itemId)
                .CountAsync();
        }

        public async Task<IEnumerable<ItemMessage>> GetMessagesWithUserByItemIdAsync(Guid itemId)
        {
            return await _context.ItemMessages
                .Where(m => m.ItemId == itemId)
                .Include(m => m.User)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<ItemMessage>> GetMessagesWithUserByUserIdAsync(Guid userId)
        {
            return await _context.ItemMessages
                .Where(m => m.UserId == userId)
                .Include(m => m.User)
                .OrderByDescending(m => m.CreatedAt)
                .ToListAsync();
        }
    }
}
