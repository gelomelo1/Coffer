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
       
        public ImageService()
        {
        }

        public async Task<string> CopyImageAsync(Guid id, string sourcePath, string destinationFolder)
        {
            if (string.IsNullOrWhiteSpace(sourcePath))
                throw new ArgumentException("Source image path is invalid", nameof(sourcePath));

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
            string fullSourcePath = sourcePath;
            var extension = Path.GetExtension(sourcePath)?.ToLower();

            // If no extension was provided, try to find a matching file
            if (string.IsNullOrEmpty(extension))
            {
                bool found = false;
                foreach (var ext in allowedExtensions)
                {
                    var attemptPath = sourcePath + ext;
                    if (File.Exists(attemptPath))
                    {
                        fullSourcePath = attemptPath;
                        extension = ext;
                        found = true;
                        break;
                    }
                }

                if (!found)
                    throw new ArgumentException($"No image file found for the provided path with allowed extensions {sourcePath} ", nameof(sourcePath));
            }
            else
            {
                // If extension exists, validate it
                if (!allowedExtensions.Contains(extension))
                    throw new ArgumentException("Invalid file extension", nameof(sourcePath));

                if (!File.Exists(fullSourcePath))
                    throw new ArgumentException("Source image file does not exist", nameof(sourcePath));
            }

            if (!Directory.Exists(destinationFolder))
                Directory.CreateDirectory(destinationFolder);

            // Delete old images for this ID
            var matchingFiles = Directory.GetFiles(destinationFolder, $"{id}_*");
            foreach (var file in matchingFiles)
            {
                await DeleteImageAsync(file, destinationFolder);
            }

            var fileName = $"{id}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
            var destinationPath = Path.Combine(destinationFolder, fileName);

            // Copy the file asynchronously
            await using (var sourceStream = new FileStream(fullSourcePath, FileMode.Open, FileAccess.Read))
            await using (var destinationStream = new FileStream(destinationPath, FileMode.CreateNew))
            {
                await sourceStream.CopyToAsync(destinationStream);
            }

            return fileName;
        }

        public Task DeleteImageAsync(string fileName, string folder)
        {
            var filePath = Path.Combine(folder, fileName);
            if(Directory.Exists(folder))
            {
                if (File.Exists(filePath))
                    File.Delete(filePath);
            }
            return Task.CompletedTask;
        }

        public async Task<(byte[] Bytes, string ContentType)> GetImageAsync(string fileName, string folder)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                throw new ArgumentException("File name must be provided.", nameof(fileName));

            if (string.IsNullOrWhiteSpace(folder))
                throw new ArgumentException("Folder path must be provided.", nameof(folder));

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };

            // If no extension provided, try to find one
            string filePath;
            if (string.IsNullOrWhiteSpace(Path.GetExtension(fileName)))
            {
                filePath = allowedExtensions
                    .Select(ext => Path.Combine(folder, fileName + ext))
                    .FirstOrDefault(File.Exists);

                if (filePath == null)
                    throw new FileNotFoundException($"No image found for '{fileName}' with allowed extensions.", fileName);
            }
            else
            {
                filePath = Path.Combine(folder, fileName);
                if (!File.Exists(filePath))
                    throw new FileNotFoundException("Image not found.", fileName);
            }

            var bytes = await File.ReadAllBytesAsync(filePath);
            var contentType = "image/" + Path.GetExtension(filePath).TrimStart('.').ToLowerInvariant();

            return (bytes, contentType);
        }

        public async Task<string> SaveImageAsync(IFormFile file, Guid id, string destinationFolder)
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

            if (!Directory.Exists(destinationFolder))
                Directory.CreateDirectory(destinationFolder);

            var matchingFiles = Directory.GetFiles(destinationFolder,  $"{id}_*");
            Console.WriteLine(matchingFiles.ToString());
            foreach (var files in matchingFiles)
            {
               await DeleteImageAsync(files, destinationFolder);
            }

            var fileName = $"{id}_{DateTime.UtcNow:yyyyMMddHHmmss}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(destinationFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return fileName;
        }

        public async Task<string> SaveImageAsync(byte[] image, Guid id, string destinationFolder, string fileName)
        {
            if (image == null || image.Length == 0)
                throw new ArgumentException("No image data provided", nameof(image));

            // Ensure folder exists
            if (!Directory.Exists(destinationFolder))
                Directory.CreateDirectory(destinationFolder);

            // Generate new file name
            var filePath = Path.Combine(destinationFolder, fileName);

            // Save byte array as file
            await using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write))
            {
                await stream.WriteAsync(image, 0, image.Length);
            }

            return fileName;
        }
    }
}
