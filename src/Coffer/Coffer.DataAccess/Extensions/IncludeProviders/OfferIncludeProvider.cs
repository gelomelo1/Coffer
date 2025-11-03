using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.DataAccess.Extensions.IncludeProviders.Interfaces;
using Coffer.Domain.Entities;

namespace Coffer.DataAccess.Extensions.IncludeProviders
{
    public class OfferIncludeProvider : IIncludeProvider<OfferProvided>
    {
        public string[]? GetDefaultIncludes()
        {
            return new[]
{
                "User.Contacts",
                "OfferItems.Item.ItemAttributes.Attribute",
                "OfferItems.Item.ItemTags",
                "OfferItems.Item.Reactions",
            };
        }
    }
}
