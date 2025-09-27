using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.DataAccess
{
    public class CofferDbContext : DbContext
    {
        public CofferDbContext(DbContextOptions<CofferDbContext> opts) : base(opts) { }

        public DbSet<User> Users { get; set; }
        public DbSet<CollectionTypeProvided> CollectionTypes { get; set; }
        public DbSet<CollectionProvided> Collections { get; set; }
    }
}
