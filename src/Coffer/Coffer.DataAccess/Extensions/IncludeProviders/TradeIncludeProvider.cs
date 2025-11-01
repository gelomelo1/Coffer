using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Extensions.IncludeProviders
{
    public class TradeIncludeProvider : IIncludeProvider<TradeProvided>
    {
        public string[]? GetDefaultIncludes()
        {
            return new[]
{
                "User.Contacts",
                "Offers.User",
                "Offers.User.Contacts",
                "Offers.OfferItems.Item.ItemAttributes.Attribute",
                "Offers.OfferItems.Item.ItemTags",
                "Offers.OfferItems.Item.Reactions",
                "TradeItems.Item.ItemAttributes.Attribute",
                "TradeItems.Item.ItemTags",
                "TradeItems.Item.Reactions"
            };
        }
    }
}
