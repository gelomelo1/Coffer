using Coffer.ASPNET.Controllers.Generic;
using Coffer.DataAccess.Repositories.Interfaces;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class TradeReviewsController : GenericController<Guid, TradeReviewProvided, TradeReviewProvided, TradeReviewRequired>
    {
        public TradeReviewsController(IGenericRepository<Guid, TradeReviewProvided, TradeReviewProvided, TradeReviewRequired> repository) : base(repository)
        {
        }
    }
}
