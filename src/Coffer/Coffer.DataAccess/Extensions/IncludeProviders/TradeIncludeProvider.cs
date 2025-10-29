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
                "TradeItems.Item",
                "Offers.User",
                "Offers.OfferItems"
            };
        }
    }
}
