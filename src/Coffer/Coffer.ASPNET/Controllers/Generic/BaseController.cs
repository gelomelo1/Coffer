using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

public abstract class BaseController : ControllerBase
{
    protected Guid? UserId
    {
        get
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (Guid.TryParse(value, out var id))
                return id;

            return null;
        }
    }
}