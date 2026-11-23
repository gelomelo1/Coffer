using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.DataAccess;
using Coffer.DataAccess.Extensions;
using Coffer.Domain.Entities;
using Coffer.Domain.Paging;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.News
{
    public sealed record NewsInput(string? Title, string? HeroImage, string? Content);

    public sealed record AdminNewsDto(Guid Id, string Title, string? HeroImage, string Content, string Status, DateTime CreatedAt,
        DateTime UpdatedAt, DateTime? PublishedAt, DateTime? EditedAt);

    /// <summary>A news card in the app: no content (the post page loads it).</summary>
    public sealed record NewsCardDto(Guid Id, string Title, string? HeroImage, DateTime PublishedAt, DateTime? EditedAt);

    public sealed record NewsPostDto(Guid Id, string Title, string? HeroImage, string Content, DateTime PublishedAt, DateTime? EditedAt);

    public interface INewsService
    {
        Task<PagedList<AdminNewsDto>> AdminListAsync(string? status, int? page, int? pageSize);
        Task<AdminNewsDto> AdminGetAsync(Guid id);
        Task<AdminNewsDto> CreateAsync(Guid adminId, NewsInput input);
        Task<AdminNewsDto> UpdateAsync(Guid adminId, Guid id, NewsInput input);
        Task<AdminNewsDto> SetPublishedAsync(Guid adminId, Guid id, bool published);
        Task DeleteAsync(Guid adminId, Guid id);
        Task<string> UploadImageAsync(Guid adminId, IFormFile? file);
        Task<PagedList<NewsCardDto>> ListPublishedAsync(int? page, int? pageSize);
        Task<NewsPostDto> GetPublishedAsync(Guid id);
    }

    /// <summary>
    /// News posts: administrators write drafts in Coffer.Manager and publish them; the app reads only published posts.
    /// The first publish fixes the post's date; edits while published are marked "edited". Every change is audited.
    /// </summary>
    public sealed class NewsService : INewsService
    {
        public const int MaxTitle = 120;
        public const int MaxContent = 50_000;

        private readonly CofferDbContext _db;
        private readonly IClock _clock;

        public NewsService(CofferDbContext db, IClock clock)
        {
            _db = db;
            _clock = clock;
        }

        // ------------------------------------------------------------------ Manager

        public async Task<PagedList<AdminNewsDto>> AdminListAsync(string? status, int? page, int? pageSize)
        {
            var query = _db.NewsPosts.AsNoTracking();
            var key = (status ?? "").Trim().ToLowerInvariant();
            if (key == "draft") query = query.Where(n => n.Status == NewsStatus.Draft);
            else if (key == "published") query = query.Where(n => n.Status == NewsStatus.Published);
            else if (key is not ("" or "all")) throw MarketplaceException.Validation("unknownNewsStatus", "Status must be draft, published or all.");
            var result = await query.OrderByDescending(n => n.UpdatedAt).ThenBy(n => n.Id).ToPagedListAsync(page, pageSize);
            return new PagedList<AdminNewsDto>(result.Items.Select(ToAdmin).ToList(), result.Page, result.PageSize, result.Total);
        }

        public async Task<AdminNewsDto> AdminGetAsync(Guid id) =>
            ToAdmin(await _db.NewsPosts.AsNoTracking().FirstOrDefaultAsync(n => n.Id == id) ?? throw NotFound());

        public async Task<AdminNewsDto> CreateAsync(Guid adminId, NewsInput input)
        {
            var (title, hero, content) = Validate(input);
            var now = _clock.UtcNow;
            var post = new NewsPost
            {
                Id = Guid.NewGuid(), Title = title, HeroImage = hero, Content = content, Status = NewsStatus.Draft,
                CreatedAt = now, UpdatedAt = now, CreatedBy = adminId, UpdatedBy = adminId,
            };
            _db.NewsPosts.Add(post);
            Audit(adminId, "news.create", post.Id, new { title });
            await _db.SaveChangesAsync();
            return ToAdmin(post);
        }

        public async Task<AdminNewsDto> UpdateAsync(Guid adminId, Guid id, NewsInput input)
        {
            var post = await _db.NewsPosts.FirstOrDefaultAsync(n => n.Id == id) ?? throw NotFound();
            var (title, hero, content) = Validate(input);
            var changed = title != post.Title || hero != post.HeroImage || content != post.Content;
            var before = new { post.Title, post.HeroImage, contentLength = post.Content.Length };
            var now = _clock.UtcNow;
            post.Title = title;
            post.HeroImage = hero;
            post.Content = content;
            post.UpdatedAt = now;
            post.UpdatedBy = adminId;
            if (changed && post.Status == NewsStatus.Published) post.EditedAt = now;
            Audit(adminId, "news.update", id, new { before, after = new { title, hero, contentLength = content.Length } });
            await _db.SaveChangesAsync();
            return ToAdmin(post);
        }

        public async Task<AdminNewsDto> SetPublishedAsync(Guid adminId, Guid id, bool published)
        {
            var post = await _db.NewsPosts.FirstOrDefaultAsync(n => n.Id == id) ?? throw NotFound();
            var wanted = published ? NewsStatus.Published : NewsStatus.Draft;
            if (post.Status == wanted) return ToAdmin(post);
            var now = _clock.UtcNow;
            post.Status = wanted;
            if (published) post.PublishedAt ??= now;
            post.UpdatedAt = now;
            post.UpdatedBy = adminId;
            Audit(adminId, published ? "news.publish" : "news.unpublish", id, new { post.Title });
            await _db.SaveChangesAsync();
            return ToAdmin(post);
        }

        public async Task DeleteAsync(Guid adminId, Guid id)
        {
            var post = await _db.NewsPosts.FirstOrDefaultAsync(n => n.Id == id) ?? throw NotFound();
            var images = NewsImages.ReferencedIn(post.Content).Append(post.HeroImage).Where(n => n != null).Select(n => n!).ToHashSet();
            var others = await _db.NewsPosts.AsNoTracking().Where(n => n.Id != id).Select(n => new { n.HeroImage, n.Content }).ToListAsync();
            var stillUsed = others.SelectMany(o => NewsImages.ReferencedIn(o.Content).Append(o.HeroImage)).Where(n => n != null).ToHashSet();

            _db.NewsPosts.Remove(post);
            Audit(adminId, "news.delete", id, new { post.Title });
            await _db.SaveChangesAsync();
            foreach (var name in images.Where(n => !stillUsed.Contains(n))) NewsImages.Delete(name);
        }

        public async Task<string> UploadImageAsync(Guid adminId, IFormFile? file)
        {
            var name = await NewsImages.SaveAsync(file);
            Audit(adminId, "news.image", null, new { fileName = name, bytes = file!.Length, original = Path.GetFileName(file.FileName) });
            try
            {
                await _db.SaveChangesAsync();
            }
            catch
            {
                NewsImages.Delete(name);
                throw;
            }
            return name;
        }

        // ------------------------------------------------------------------ app

        public async Task<PagedList<NewsCardDto>> ListPublishedAsync(int? page, int? pageSize)
        {
            var result = await _db.NewsPosts.AsNoTracking().Where(n => n.Status == NewsStatus.Published)
                .OrderByDescending(n => n.PublishedAt).ThenBy(n => n.Id).ToPagedListAsync(page, pageSize);
            return new PagedList<NewsCardDto>(result.Items.Select(n => new NewsCardDto(n.Id, n.Title, n.HeroImage, Utc(n.PublishedAt!.Value), Utc(n.EditedAt))).ToList(),
                result.Page, result.PageSize, result.Total);
        }

        public async Task<NewsPostDto> GetPublishedAsync(Guid id)
        {
            var n = await _db.NewsPosts.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id && p.Status == NewsStatus.Published) ?? throw NotFound();
            return new NewsPostDto(n.Id, n.Title, n.HeroImage, n.Content, Utc(n.PublishedAt!.Value), Utc(n.EditedAt));
        }

        // ------------------------------------------------------------------ helpers

        private static (string Title, string? Hero, string Content) Validate(NewsInput input)
        {
            var title = Text.Required(input.Title, 1, MaxTitle, "Title");
            var content = input.Content ?? "";
            if (content.Length > MaxContent)
                throw MarketplaceException.Validation("newsTooLong", "The content can be at most 50 000 characters.");
            var hero = string.IsNullOrWhiteSpace(input.HeroImage) ? null : input.HeroImage.Trim();
            foreach (var name in NewsImages.ReferencedIn(content).Append(hero).Where(n => n != null))
                if (!NewsImages.Exists(name))
                    throw MarketplaceException.Validation("newsImageNotFound", "An image of the post was not uploaded (or was deleted).");
            return (title, hero, content);
        }

        private void Audit(Guid adminId, string action, Guid? newsId, object details) =>
            AdminAudit.Add(_db, adminId, action, "news", newsId, details, _clock.UtcNow);

        private static DateTime Utc(DateTime at) => DateTime.SpecifyKind(at, DateTimeKind.Utc);
        private static DateTime? Utc(DateTime? at) => at == null ? null : Utc(at.Value);

        private static AdminNewsDto ToAdmin(NewsPost n) => new(n.Id, n.Title, n.HeroImage, n.Content,
            n.Status == NewsStatus.Published ? "published" : "draft", Utc(n.CreatedAt), Utc(n.UpdatedAt), Utc(n.PublishedAt), Utc(n.EditedAt));

        private static MarketplaceException NotFound() => MarketplaceException.NotFound("newsNotFound", "News post not found.");
    }
}
