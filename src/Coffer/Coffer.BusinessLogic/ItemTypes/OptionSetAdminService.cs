using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.DataAccess;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Coffer.BusinessLogic.ItemTypes
{
    /// <summary>An option of a set; Id null = a new option (it gets the next unused id).</summary>
    public sealed record OptionInput(int? Id, string? Label);

    public sealed record OptionSetInput(List<OptionInput>? Options, Dictionary<string, string>? LabelTranslations);

    public sealed record AdminOptionDto(int Id, string Label, int UsedByItems);

    /// <summary>A set with where it is used ("Cap › Features") and how many items use each option.</summary>
    public sealed record AdminOptionSetDto(int Id, List<AdminOptionDto> Options, Dictionary<string, string> LabelTranslations, List<string> UsedBy);

    public interface IOptionSetAdminService
    {
        Task<List<AdminOptionSetDto>> ListAsync();
        Task<AdminOptionSetDto> CreateAsync(Guid adminId, OptionSetInput input);
        Task<AdminOptionSetDto> UpdateAsync(Guid adminId, int id, OptionSetInput input);
        Task DeleteAsync(Guid adminId, int id);
    }

    /// <summary>
    /// The lists select / multi-select / autocomplete attributes pick from (item_options: ids and labels joined by ';',
    /// item values store the ids — "2", or "1;4;" for several). An option an item uses can't be removed; ids are never
    /// reused; labels and their translations can always change.
    /// </summary>
    public sealed class OptionSetAdminService : IOptionSetAdminService
    {
        public const int MaxOptions = 200;
        public const int MaxLabel = 60;

        private readonly CofferDbContext _db;
        private readonly IClock _clock;

        public OptionSetAdminService(CofferDbContext db, IClock clock)
        {
            _db = db;
            _clock = clock;
        }

        public async Task<List<AdminOptionSetDto>> ListAsync()
        {
            var sets = await _db.ItemOptions.AsNoTracking().OrderBy(o => o.Id).ToListAsync();
            var result = new List<AdminOptionSetDto>();
            foreach (var set in sets) result.Add(await ToDtoAsync(set));
            return result;
        }

        public async Task<AdminOptionSetDto> CreateAsync(Guid adminId, OptionSetInput input)
        {
            var labels = ValidateLabels(input);
            if (labels.Any(o => o.Id != null))
                throw MarketplaceException.Validation("unknownOption", "A new option set can't refer to existing option ids.");
            var set = new ItemOptions
            {
                OptionIds = string.Join(";", labels.Select((_, i) => i + 1)),
                OptionLabels = string.Join(";", labels.Select(o => o.Label)),
                OptionLabelsTranslations = Translations.Validate(input.LabelTranslations, MaxLabel, labels.Count),
                LastOptionId = labels.Count,
            };
            _db.ItemOptions.Add(set);
            await _db.SaveChangesAsync();
            Audit(adminId, "optionSet.create", new { optionSetId = set.Id, set.OptionIds, set.OptionLabels, set.OptionLabelsTranslations });
            await _db.SaveChangesAsync();
            return await ToDtoAsync(set);
        }

        public async Task<AdminOptionSetDto> UpdateAsync(Guid adminId, int id, OptionSetInput input)
        {
            var set = await _db.ItemOptions.FirstOrDefaultAsync(o => o.Id == id) ?? throw NotFound();
            var labels = ValidateLabels(input);
            var current = Ids(set.OptionIds);
            var kept = labels.Where(o => o.Id != null).Select(o => o.Id!.Value).ToList();
            if (kept.Any(i => !current.Contains(i)))
                throw MarketplaceException.Validation("unknownOption", "An option id does not belong to this set.");
            if (kept.Distinct().Count() != kept.Count)
                throw MarketplaceException.Validation("duplicateOption", "An option appears twice.");

            var removed = current.Except(kept).ToList();
            if (removed.Count > 0)
            {
                var usage = await UsageAsync(set.Id);
                var used = removed.Where(i => usage.GetValueOrDefault(i) > 0).ToList();
                if (used.Count > 0)
                    throw MarketplaceException.Conflict("optionInUse", $"Items use option(s) {string.Join(", ", used)}: they can't be removed.",
                        ErrorArgs.Of(string.Join(", ", used)));
            }

            var next = Math.Max(set.LastOptionId, current.DefaultIfEmpty(0).Max());
            var ids = labels.Select(o => o.Id ?? ++next).ToList();
            var before = new { set.OptionIds, set.OptionLabels, set.OptionLabelsTranslations };
            set.OptionIds = string.Join(";", ids);
            set.OptionLabels = string.Join(";", labels.Select(o => o.Label));
            set.OptionLabelsTranslations = Translations.Validate(input.LabelTranslations, MaxLabel, labels.Count);
            set.LastOptionId = next;
            Audit(adminId, "optionSet.update", new { optionSetId = id, before, after = new { set.OptionIds, set.OptionLabels, set.OptionLabelsTranslations } });
            await _db.SaveChangesAsync();
            return await ToDtoAsync(set);
        }

        public async Task DeleteAsync(Guid adminId, int id)
        {
            var set = await _db.ItemOptions.FirstOrDefaultAsync(o => o.Id == id) ?? throw NotFound();
            var attributes = await _db.Attributes.CountAsync(a => a.ItemOptionsId == id);
            if (attributes > 0)
                throw MarketplaceException.Conflict("optionSetInUse", $"{attributes} attribute(s) use this option set; it can't be deleted.", ErrorArgs.Of($"{attributes}"));
            _db.ItemOptions.Remove(set);
            Audit(adminId, "optionSet.delete", new { optionSetId = id, set.OptionIds, set.OptionLabels });
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ helpers

        private static List<(int? Id, string Label)> ValidateLabels(OptionSetInput input)
        {
            var options = input.Options ?? new List<OptionInput>();
            if (options.Count == 0 || options.Count > MaxOptions)
                throw MarketplaceException.Validation("invalidOptions", $"An option set needs 1–{MaxOptions} options.");
            return options.Select(o =>
            {
                var label = Text.Required(o.Label, 1, MaxLabel, "Option");
                if (label.Contains(';'))
                    throw MarketplaceException.Validation("invalidOptionLabel", "An option label can't contain ';'.");
                return (o.Id, label);
            }).ToList();
        }

        private static List<int> Ids(string? joined) =>
            (joined ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => int.TryParse(s, out var i) ? i : (int?)null).Where(i => i.HasValue).Select(i => i!.Value).ToList();

        /// <summary>How many items use each option id of the set, through any attribute that picks from it.</summary>
        private async Task<Dictionary<int, int>> UsageAsync(int setId)
        {
            var values = await _db.ItemAttributes.AsNoTracking()
                .Where(v => _db.Attributes.Any(a => a.Id == v.AttributeId && a.ItemOptionsId == setId) && v.ValueString != null && v.ValueString != "")
                .Select(v => new { v.ItemId, v.ValueString })
                .ToListAsync();
            return values
                .SelectMany(v => Ids(v.ValueString).Distinct().Select(id => (id, v.ItemId)))
                .Distinct()
                .GroupBy(x => x.id)
                .ToDictionary(g => g.Key, g => g.Count());
        }

        private async Task<AdminOptionSetDto> ToDtoAsync(ItemOptions set)
        {
            var usage = await UsageAsync(set.Id);
            var ids = Ids(set.OptionIds);
            var labels = (set.OptionLabels ?? "").Split(';');
            var usedBy = await _db.Attributes.AsNoTracking().Where(a => a.ItemOptionsId == set.Id)
                .Join(_db.CollectionTypes, a => a.CollectionTypeId, t => t.Id, (a, t) => t.Name + " › " + a.Name)
                .ToListAsync();
            return new AdminOptionSetDto(set.Id,
                ids.Select((id, i) => new AdminOptionDto(id, i < labels.Length ? labels[i] : "", usage.GetValueOrDefault(id))).ToList(),
                set.OptionLabelsTranslations, usedBy);
        }

        private void Audit(Guid adminId, string action, object details) =>
            AdminAudit.Add(_db, adminId, action, "optionSet", null, details, _clock.UtcNow);

        private static MarketplaceException NotFound() => MarketplaceException.NotFound("optionSetNotFound", "Option set not found.");
    }
}
