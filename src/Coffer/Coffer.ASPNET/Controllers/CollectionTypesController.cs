using Microsoft.AspNetCore.Authorization;
﻿using Coffer.ASPNET.Controllers.Generic;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Coffer.DataAccess.Repositories.Interfaces;

namespace Coffer.ASPNET.Controllers
{
    [Route("api/[controller]")]
    public class CollectionTypesController : ReadOnlyGenericController<int, CollectionTypeProvided, CollectionTypeProvided>
    {
        private readonly Coffer.BusinessLogic.ItemTypes.IItemTypeFiles _files;

        public CollectionTypesController(IReadOnlyGenericRepository<int, CollectionTypeProvided, CollectionTypeProvided> genericRepository,
            Coffer.BusinessLogic.ItemTypes.IItemTypeFiles files) : base(genericRepository)
        {
            _files = files;
        }

        /// <summary>An item type's icon (public, like any app asset). Only valid icon names are looked up.</summary>
        [AllowAnonymous]
        [HttpGet("Icon/{fileName}")]
        public IActionResult Icon(string fileName)
        {
            var icon = _files.OpenIcon(fileName);
            if (icon == null) return NotFound();
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            Response.Headers["Cache-Control"] = "public, max-age=86400";
            return File(icon.Value.Stream, icon.Value.ContentType);
        }
    }
}
