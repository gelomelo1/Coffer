using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Http;

namespace Coffer.BusinessLogic.Services.Interfaces
{
    public interface IImageService
    {
        Task<string> SaveImageAsync(IFormFile file, Guid id, string relativePath);
        Task<(byte[] Bytes, string ContentType)> GetImageAsync(string fileName, string relativePath);
        Task DeleteImageAsync(string fileName, string relativePath);
    }
}
