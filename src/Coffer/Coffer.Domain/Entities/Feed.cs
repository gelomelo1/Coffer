using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Coffer.Domain.Entities
{
    public class Feed
    {
        public ItemProvided Item {  get; set; }
        public UserProvided User { get; set; }
        public CollectionProvided Collection { get; set; }

        public Feed(ItemProvided item, UserProvided user, CollectionProvided collection )
        {
            Item = item;
            User = user;
            Collection = collection;
        }
    }
}
