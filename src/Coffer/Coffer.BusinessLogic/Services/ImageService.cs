using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.Domain.Entities;
using DotNetEnv;
using Microsoft.AspNetCore.Http;

namespace Coffer.BusinessLogic.Services
{
    public class ImageService : IImageService
    {
        private readonly string _rootFolder= Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set");

        public ImageService()
        {
            _rootFolder = Env.GetString("IMAGESTORE_PATH")
           ?? throw new InvalidOperationException("IMAGESTORE_PATH environment variable is not set");

            if (!Directory.Exists(_rootFolder))
                Directory.CreateDirectory(_rootFolder);
        }

        public Task DeleteImageAsync(string fileName, string relativePath)
        {
            var folder = Path.Combine(_rootFolder, relativePath);
            var filePath = Path.Combine(folder, fileName);
            if(Directory.Exists(folder))
            {
                if (File.Exists(filePath))
                    File.Delete(filePath);
            }
            return Task.CompletedTask;
        }

        public async Task<(byte[] Bytes, string ContentType)> GetImageAsync(string fileName, string relativePath)
        {

            var filePath = Path.Combine(_rootFolder, relativePath, fileName);

            if (!File.Exists(filePath))
                throw new FileNotFoundException("Image not found.", fileName);

            var bytes = await File.ReadAllBytesAsync(filePath);
            var contentType = "image/" + Path.GetExtension(filePath).TrimStart('.').ToLower();
            return (bytes, contentType);
        }

        public async Task<string> SaveImageAsync(IFormFile file, Guid id, string relativePath)
        {
            if (file == null || file.Length == 0)
                throw new ArgumentException("No file uploaded", nameof(file));

            var allowedMimeTypes = new[] { "image/jpeg", "image/png" };
            if (!allowedMimeTypes.Contains(file.ContentType.ToLower()))
                throw new ArgumentException("Only image files are allowed", nameof(file));

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
            var extension = Path.GetExtension(file.FileName).ToLower();
            if (!allowedExtensions.Contains(extension))
                throw new ArgumentException("Invalid file extension", nameof(file));


            var folder = Path.Combine(_rootFolder, relativePath);
            if (!Directory.Exists(folder))
                Directory.CreateDirectory(folder);

            var matchingFiles = Directory.GetFiles(folder,  $"{id}_*");
            Console.WriteLine(matchingFiles.ToString());
            foreach (var files in matchingFiles)
            {
               await DeleteImageAsync(files, folder);
            }

            var fileName = $"{id}_{DateTime.UtcNow:yyyyMMddHHmmss}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(folder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return fileName;
        }
    }
}
