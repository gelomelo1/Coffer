using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class TradesController : GenericController<Guid, TradeProvided, TradeProvided, TradeRequired>
    {
        public TradesController(ITradesRepository repository) : base(repository)
        {
        }
    }
}
