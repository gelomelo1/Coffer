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
        Task<string> CopyImageAsync(Guid id, string url, string destinationFolder);
        Task<string> SaveImageAsync(IFormFile file, Guid id, string destinationFolder);
        Task<string> SaveImageAsync(byte[] image, Guid id, string destinationFolder, string fileName);
        Task<(byte[] Bytes, string ContentType)> GetImageAsync(string fileName, string folder);
        Task DeleteImageAsync(string fileName, string folder);
    }
}
