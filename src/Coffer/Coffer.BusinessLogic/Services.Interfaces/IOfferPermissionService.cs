using Coffer.Domain.Entities;

namespace Coffer.BusinessLogic.Services.Interfaces
{
    public interface IOfferPermissionService : IPermissionService<Guid, OfferRequired>
    {
        Task<bool> CanChangeStatus(Guid userId, Guid offerId, string status);
    }
}
