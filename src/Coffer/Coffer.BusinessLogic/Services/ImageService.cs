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

        /// <summary>
        /// Stored image names are always "{entityId}_{timestamp}{ext}" (see SaveImageAsync / CopyImageAsync).
        /// Used so an entity can only delete its own image file, never another entity's.
        /// </summary>
        public static bool IsImageOf(string? fileName, Guid ownerId)
        {
            return !string.IsNullOrWhiteSpace(fileName)
                && IsPlainFileName(fileName)
                && fileName.StartsWith($"{ownerId}_", StringComparison.OrdinalIgnoreCase);
        }

        public async Task DeleteOwnedImageAsync(string? fileName, Guid ownerId, string folder)
        {
            if (!IsImageOf(fileName, ownerId))
                return;

            try
            {
                await DeleteImageAsync(fileName!, folder);
            }
            catch (Exception e)
            {
                // The database change is already committed; an orphaned file is harmless.
                Console.WriteLine($"Failed to delete image '{fileName}': {e.GetType().Name}");
            }
        }

        private static bool IsPlainFileName(string fileName)
        {
            return fileName.IndexOfAny(new[] { '/', '\\' }) < 0
                && !Path.IsPathRooted(fileName)
                && fileName != "."
                && fileName != ".."
                && fileName.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
        }

        /// <summary>
        /// Resolves a file name inside <paramref name="folder"/>. Returns null for anything that is not a
        /// plain file name or would resolve outside the folder (path traversal, absolute paths).
        /// </summary>
        private static string? ResolveInFolder(string fileName, string folder)
        {
            if (string.IsNullOrWhiteSpace(fileName) || !IsPlainFileName(fileName))
                return null;

            var root = Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            var full = Path.GetFullPath(Path.Combine(root, fileName));

            return full.StartsWith(root, StringComparison.Ordinal) ? full : null;
        }

        public async Task<string> CopyImageAsync(Guid id, string sourcePath, string destinationFolder)
        {
            if (string.IsNullOrWhiteSpace(sourcePath))
                throw new ArgumentException("Source image path is invalid", nameof(sourcePath));

            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png" };
            string fullSourcePath = sourcePath;
            var extension = Path.GetExtension(sourcePath)?.ToLower();

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
                if (!allowedExtensions.Contains(extension))
                    throw new ArgumentException("Invalid file extension", nameof(sourcePath));

                if (!File.Exists(fullSourcePath))
                    throw new ArgumentException("Source image file does not exist", nameof(sourcePath));
            }

            if (!Directory.Exists(destinationFolder))
                Directory.CreateDirectory(destinationFolder);

            var matchingFiles = Directory.GetFiles(destinationFolder, $"{id}_*");
            foreach (var file in matchingFiles)
            {
                await DeleteImageAsync(Path.GetFileName(file), destinationFolder);
            }

            var fileName = $"{id}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
            var destinationPath = Path.Combine(destinationFolder, fileName);

            await using (var sourceStream = new FileStream(fullSourcePath, FileMode.Open, FileAccess.Read))
            await using (var destinationStream = new FileStream(destinationPath, FileMode.CreateNew))
            {
                await sourceStream.CopyToAsync(destinationStream);
            }

            return fileName;
        }

        public Task DeleteImageAsync(string fileName, string folder)
        {
            var filePath = ResolveInFolder(fileName, folder)
                ?? throw new ArgumentException("Invalid image file name", nameof(fileName));
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

            string? filePath;
            if (string.IsNullOrWhiteSpace(Path.GetExtension(fileName)))
            {
                filePath = allowedExtensions
                    .Select(ext => ResolveInFolder(fileName + ext, folder))
                    .FirstOrDefault(path => path != null && File.Exists(path));

                if (filePath == null)
                    throw new FileNotFoundException($"No image found for '{fileName}' with allowed extensions.", fileName);
            }
            else
            {
                filePath = ResolveInFolder(fileName, folder);
                if (filePath == null || !File.Exists(filePath))
                    throw new FileNotFoundException("Image not found.", fileName);
            }

            var bytes = await File.ReadAllBytesAsync(filePath);
            var contentType = "image/" + Path.GetExtension(filePath).TrimStart('.').ToLowerInvariant();

            return (bytes, contentType);
        }

        /// <summary>Stores a user's photo; one wider than <paramref name="maxWidth"/> or carrying metadata is re-encoded first (UploadedImages).</summary>
        public async Task<string> SaveImageAsync(IFormFile file, Guid id, string destinationFolder, int maxWidth)
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
            foreach (var files in matchingFiles)
            {
               await DeleteImageAsync(Path.GetFileName(files), destinationFolder);
            }

            var prepared = await Coffer.BusinessLogic.Images.UploadedImages.PrepareAsync(file, maxWidth);
            var fileName = $"{id}_{DateTime.UtcNow:yyyyMMddHHmmss}{prepared.Extension}";
            var filePath = Path.Combine(destinationFolder, fileName);

            await File.WriteAllBytesAsync(filePath, prepared.Bytes);

            return fileName;
        }

        public async Task<string> SaveImageAsync(byte[] image, Guid id, string destinationFolder, string fileName)
        {
            if (image == null || image.Length == 0)
                throw new ArgumentException("No image data provided", nameof(image));

            if (!Directory.Exists(destinationFolder))
                Directory.CreateDirectory(destinationFolder);

            var filePath = ResolveInFolder(fileName, destinationFolder)
                ?? throw new ArgumentException("Invalid image file name", nameof(fileName));

            await using (var stream = new FileStream(filePath, FileMode.Create, FileAccess.Write))
            {
                await stream.WriteAsync(image, 0, image.Length);
            }

            return fileName;
        }
    }
}
