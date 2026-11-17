using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Services.Interfaces;
using Coffer.DataAccess;
using DotNetEnv;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Coffer.BusinessLogic.DevSeed
{
    /// <summary>Development-only switches from .env.development.</summary>
    public sealed record DevSeedOptions(bool Enabled, bool ResetOnStartup, string? DataJson, string? ImageDir, int AiWaitSeconds)
    {
        public static DevSeedOptions FromEnvironment() => new(
            Flag("DEV_SEED_ENABLED"),
            Flag("DEV_RESET_DATABASE_ON_STARTUP"),
            Environment.GetEnvironmentVariable("DEV_SEED_DATA_JSON"),
            Environment.GetEnvironmentVariable("DEV_SEED_IMAGE_DIR"),
            int.TryParse(Environment.GetEnvironmentVariable("DEV_SEED_AI_WAIT_SECONDS"), out var s) ? Math.Max(0, s) : 120);

        public bool AnythingToDo => Enabled || ResetOnStartup;

        private static bool Flag(string name) =>
            (Environment.GetEnvironmentVariable(name) ?? "").Trim().ToLowerInvariant() is "true" or "1" or "yes";
    }

    public static class DevSeedGuard
    {
        /// <summary>The dev login must never be switched on outside Development.</summary>
        public static void CheckDevLogin(string environmentName)
        {
            if (DevLoginService.FlagSet && !string.Equals(environmentName, "Development", StringComparison.Ordinal))
                throw new InvalidOperationException(
                    $"{DevLoginService.EnvName} is set, but the environment is '{environmentName}'. The dev login only exists in Development; remove the setting.");
        }

        /// <summary>
        /// Fails fast when seeding or resetting is switched on outside Development, so a copied .env can never wipe
        /// a production or staging database.
        /// </summary>
        public static void Check(string environmentName, DevSeedOptions options)
        {
            if (!options.AnythingToDo) return;
            if (!string.Equals(environmentName, "Development", StringComparison.Ordinal))
                throw new InvalidOperationException(
                    $"DEV_SEED_ENABLED / DEV_RESET_DATABASE_ON_STARTUP are set, but the environment is '{environmentName}'. " +
                    "Development seeding and database reset only run in the Development environment; remove these settings.");
        }
    }

    public sealed record DevResetResult(List<Guid> CollectionIds, List<(string Folder, string File)> Files);

    /// <summary>
    /// Empties every user-data table (reference data — collection types, attributes, item options, cities — and the
    /// Coffer.Manager admin identities stay). Provider-agnostic EF deletes in foreign-key order inside one transaction.
    /// </summary>
    public sealed class DevDatabaseResetter
    {
        private readonly CofferDbContext _db;

        public DevDatabaseResetter(CofferDbContext db)
        {
            _db = db;
        }

        public async Task<DevResetResult> ResetAsync(string imageRoot, string listingFolder, string dealFolder)
        {
            // Remember which files and embeddings belonged to the rows that are about to disappear.
            var collectionIds = await _db.Collections.Select(c => c.Id).ToListAsync();
            var files = new List<(string, string)>();
            files.AddRange((await _db.Items.Select(i => i.Image).ToListAsync()).Select(f => (Path.Combine(imageRoot, "items"), f)));
            files.AddRange((await _db.Collections.Where(c => c.Image != null).Select(c => c.Image!).ToListAsync()).Select(f => (Path.Combine(imageRoot, "collectioncovers"), f)));
            files.AddRange((await _db.ListingImages.Select(i => i.FileName).ToListAsync()).Select(f => (listingFolder, f)));
            files.AddRange((await _db.Deals.Where(d => d.ShipmentPhoto != null).Select(d => d.ShipmentPhoto!).ToListAsync()).Select(f => (dealFolder, f)));
            files.AddRange((await _db.Deals.Where(d => d.ReceiptPhoto != null).Select(d => d.ReceiptPhoto!).ToListAsync()).Select(f => (dealFolder, f)));

            await using var tx = await _db.Database.BeginTransactionAsync();
            await _db.ItemCommentMentions.ExecuteDeleteAsync();
            // One statement for the whole comment tree: the parent FK (NO ACTION) is checked at the end of it.
            await _db.ItemComments.ExecuteDeleteAsync();
            await _db.Reports.ExecuteDeleteAsync();
            await _db.ModerationActions.ExecuteDeleteAsync();
            await _db.Reviews.ExecuteDeleteAsync();
            await _db.Deals.ExecuteDeleteAsync();
            await _db.Messages.ExecuteDeleteAsync();
            await _db.ConversationParticipants.ExecuteDeleteAsync();
            await _db.Conversations.ExecuteDeleteAsync();
            await _db.ListingLines.ExecuteDeleteAsync();
            await _db.ListingImages.ExecuteDeleteAsync();
            await _db.Listings.ExecuteDeleteAsync();
            await _db.Reactions.ExecuteDeleteAsync();
            await _db.Follows.ExecuteDeleteAsync();
            await _db.ItemTags.ExecuteDeleteAsync();
            await _db.ItemAttributes.ExecuteDeleteAsync();
            await _db.Items.ExecuteDeleteAsync();
            await _db.Collections.ExecuteDeleteAsync();
            await _db.UserSuspensions.ExecuteDeleteAsync();
            await _db.AdminAuditLog.ExecuteDeleteAsync();
            await _db.Users.ExecuteDeleteAsync();
            await tx.CommitAsync();
            _db.ChangeTracker.Clear();

            return new DevResetResult(collectionIds, files);
        }
    }

    /// <summary>
    /// Runs once at API startup (never in the Python service): optional reset, then optional seed. A Postgres
    /// advisory lock makes sure two API processes sharing the database can't reset or seed at the same time.
    /// </summary>
    public sealed class DevSeedRunner
    {
        private const long AdvisoryLockKey = 0x436F66666572; // "Coffer"
        private readonly CofferDbContext _db;
        private readonly DevDatabaseResetter _resetter;
        private readonly DevSeeder _seeder;
        private readonly IAiImagePipeline _ai;
        private readonly IImageService _images;
        private readonly MarketplaceStorage _storage;
        private readonly ILogger<DevSeedRunner> _log;

        public DevSeedRunner(CofferDbContext db, DevDatabaseResetter resetter, DevSeeder seeder, IAiImagePipeline ai, IImageService images,
            MarketplaceStorage storage, ILogger<DevSeedRunner> log)
        {
            _db = db;
            _resetter = resetter;
            _seeder = seeder;
            _ai = ai;
            _images = images;
            _storage = storage;
            _log = log;
        }

        public async Task RunAsync(string environmentName, DevSeedOptions options)
        {
            DevSeedGuard.Check(environmentName, options);
            if (!options.AnythingToDo) return;

            // Validate before touching anything: a broken JSON must not leave an empty database behind.
            DevSeedData? data = null;
            if (options.Enabled)
            {
                data = DevSeedValidator.Parse(options.DataJson);
                DevSeedValidator.Validate(data, await _seeder.ReferenceDataAsync());
            }

            var isPostgres = _db.Database.ProviderName == "Npgsql.EntityFrameworkCore.PostgreSQL";
            if (isPostgres)
            {
                await _db.Database.OpenConnectionAsync();
                await _db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_lock({0})", AdvisoryLockKey);
            }

            try
            {
                if (options.ResetOnStartup)
                    await ResetAsync();

                if (data != null)
                {
                    if (!options.ResetOnStartup && await _seeder.AlreadySeededAsync(data))
                    {
                        _log.LogInformation("Dev seed: the seed users already exist, nothing inserted (set DEV_RESET_DATABASE_ON_STARTUP=true for a fresh copy).");
                    }
                    else
                    {
                        var conflicts = await _seeder.LoginConflictsAsync(data);
                        if (conflicts.Count > 0)
                            throw new DevSeedConfigException(conflicts.Select(c => c + " — set DEV_RESET_DATABASE_ON_STARTUP=true once, or change the seed user's providerUserId.").ToList());
                        await _seeder.SeedAsync(data, options);
                    }
                }
            }
            finally
            {
                if (isPostgres)
                {
                    await _db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_unlock({0})", AdvisoryLockKey);
                    await _db.Database.CloseConnectionAsync();
                }
            }
        }

        private async Task ResetAsync()
        {
            var root = Env.GetString("IMAGESTORE_PATH") ?? throw new InvalidOperationException("IMAGESTORE_PATH envionmental variable is not set");
            _log.LogWarning("Dev reset: DEV_RESET_DATABASE_ON_STARTUP=true — deleting all user data from the development database.");
            var result = await _resetter.ResetAsync(root, _storage.ListingImages, _storage.DealImages);

            var aiUp = result.CollectionIds.Count > 0 && await _ai.IsAvailableAsync();
            foreach (var collectionId in result.CollectionIds)
            {
                if (!aiUp) break;
                try { await _ai.DeleteCollectionEmbeddingsAsync(collectionId); }
                catch (Exception e) { _log.LogWarning("Dev reset: could not delete the embeddings of collection {Id}: {Error}", collectionId, e.Message); }
            }
            if (result.CollectionIds.Count > 0 && !aiUp)
                _log.LogWarning("Dev reset: the AI service is not reachable, so old embeddings of {Count} collection(s) stay in the vector store.", result.CollectionIds.Count);

            var deleted = 0;
            foreach (var (folder, file) in result.Files)
            {
                try
                {
                    if (File.Exists(Path.Combine(folder, file))) { await _images.DeleteImageAsync(file, folder); deleted++; }
                }
                catch (Exception e) { _log.LogWarning("Dev reset: could not delete {File}: {Error}", file, e.Message); }
            }
            _log.LogWarning("Dev reset done: database emptied, {Files} image file(s) of the deleted rows removed.", deleted);
        }
    }
}
