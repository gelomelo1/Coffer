using System.Text.RegularExpressions;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.DataAccess;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Attribute = Coffer.Domain.Entities.Attribute;

namespace Coffer.BusinessLogic.ItemTypes
{
    public sealed record ItemTypeInput(string? Name, Dictionary<string, string>? NameTranslations, string? Description,
        Dictionary<string, string>? DescriptionTranslations, string? Color);

    public sealed record AttributeInput(string? Name, Dictionary<string, string>? NameTranslations, AttributeType DataType,
        bool Primary, bool Required, int? OptionSetId);

    public sealed record AdminAttributeDto(int Id, string Name, Dictionary<string, string> NameTranslations, AttributeType DataType,
        bool Primary, bool Required, int? OptionSetId, int UsedByItems);

    /// <summary>One item type as the Manager sees it, including what still blocks publishing.</summary>
    public sealed record AdminItemTypeDto(int Id, string Name, Dictionary<string, string> NameTranslations, string Description,
        Dictionary<string, string> DescriptionTranslations, string Color, string Icon, bool Published, DateTime? UnpublishedAt,
        ModelFileDto? Detection, ModelFileDto? Embedding, int Collections, int Listings, List<AdminAttributeDto> Attributes,
        List<string> PublishBlockers);

    public interface IItemTypeAdminService
    {
        Task<List<AdminItemTypeDto>> ListAsync();
        Task<AdminItemTypeDto> GetAsync(int id);
        Task<AdminItemTypeDto> CreateAsync(Guid adminId, ItemTypeInput input);
        Task<AdminItemTypeDto> UpdateAsync(Guid adminId, int id, ItemTypeInput input);
        Task DeleteAsync(Guid adminId, int id);
        Task<AdminAttributeDto> AddAttributeAsync(Guid adminId, int typeId, AttributeInput input);
        Task<AdminAttributeDto> UpdateAttributeAsync(Guid adminId, int attributeId, AttributeInput input);
        Task DeleteAttributeAsync(Guid adminId, int attributeId);
        Task<AdminItemTypeDto> SetIconAsync(Guid adminId, int id, Microsoft.AspNetCore.Http.IFormFile? file);
        Task<AdminItemTypeDto> SetModelsAsync(Guid adminId, int id, Microsoft.AspNetCore.Http.IFormFile? detection,
            Microsoft.AspNetCore.Http.IFormFile? embedding, int? classCount);
    }

    /// <summary>
    /// Item types and their attributes, for Coffer.Manager administrators. What items already use keeps its meaning:
    /// an attribute with values can't be deleted or change its data type or option set, and a type in use can't be
    /// deleted; names and translations can always change. Every change is in the admin audit log.
    /// </summary>
    public sealed class ItemTypeAdminService : IItemTypeAdminService
    {
        public const int MaxName = 60;
        public const int MaxDescription = 500;
        public const int MaxAttributes = 30;
        private static readonly Regex Color = new("^#[0-9A-Fa-f]{6}$", RegexOptions.CultureInvariant);
        private static readonly AttributeType[] OptionTypes = { AttributeType.Select, AttributeType.Multi_Select, AttributeType.Autocomplete };

        private readonly CofferDbContext _db;
        private readonly IClock _clock;
        private readonly IItemTypeFiles _files;

        public ItemTypeAdminService(CofferDbContext db, IClock clock, IItemTypeFiles files)
        {
            _db = db;
            _clock = clock;
            _files = files;
        }

        // ------------------------------------------------------------------ item types

        public async Task<List<AdminItemTypeDto>> ListAsync()
        {
            var ids = await _db.CollectionTypes.AsNoTracking().OrderBy(t => t.Id).Select(t => t.Id).ToListAsync();
            var result = new List<AdminItemTypeDto>();
            foreach (var id in ids) result.Add(await GetAsync(id));
            return result;
        }

        public async Task<AdminItemTypeDto> GetAsync(int id)
        {
            var type = await _db.CollectionTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id) ?? throw TypeNotFound();
            var attributes = await _db.Attributes.AsNoTracking().Where(a => a.CollectionTypeId == id).OrderBy(a => a.Id).ToListAsync();
            var attributeIds = attributes.Select(a => a.Id).ToList();
            var used = await _db.ItemAttributes.AsNoTracking().Where(v => attributeIds.Contains(v.AttributeId))
                .GroupBy(v => v.AttributeId).Select(g => new { g.Key, Count = g.Select(v => v.ItemId).Distinct().Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count);
            var collections = await _db.Collections.CountAsync(c => c.CollectionTypeId == id);
            var listings = await _db.Listings.CountAsync(l => l.CollectionTypeId == id);
            var detection = _files.Detection(id);
            var embedding = _files.Embedding(id);

            var blockers = new List<string>();
            if (detection == null || embedding == null) blockers.Add("itemTypeNeedsModels");
            if (attributes.Count(a => a.Primary) != 1) blockers.Add("itemTypeNeedsPrimaryAttribute");
            if (string.IsNullOrEmpty(type.Icon)) blockers.Add("itemTypeNeedsIcon");

            return new AdminItemTypeDto(type.Id, type.Name, type.NameTranslations, type.Description ?? "", type.DescriptionTranslations,
                type.Color, type.Icon ?? "", type.Published, type.UnpublishedAt, detection, embedding, collections, listings,
                attributes.Select(a => ToDto(a, used.GetValueOrDefault(a.Id))).ToList(), blockers);
        }

        public async Task<AdminItemTypeDto> CreateAsync(Guid adminId, ItemTypeInput input)
        {
            var (name, nameTranslations, description, descriptionTranslations, color) = Validate(input);
            await EnsureTypeNameFreeAsync(name, null);
            var type = new CollectionTypeProvided(name, description, color, "")
            {
                NameTranslations = nameTranslations,
                DescriptionTranslations = descriptionTranslations,
                Published = false,
                CreatedAt = _clock.UtcNow,
            };
            _db.CollectionTypes.Add(type);
            await _db.SaveChangesAsync();
            Audit(adminId, "itemType.create", new { itemTypeId = type.Id, name, color });
            await _db.SaveChangesAsync();
            return await GetAsync(type.Id);
        }

        public async Task<AdminItemTypeDto> UpdateAsync(Guid adminId, int id, ItemTypeInput input)
        {
            var type = await _db.CollectionTypes.FirstOrDefaultAsync(t => t.Id == id) ?? throw TypeNotFound();
            var (name, nameTranslations, description, descriptionTranslations, color) = Validate(input);
            await EnsureTypeNameFreeAsync(name, id);
            var before = new { type.Name, type.NameTranslations, type.Description, type.DescriptionTranslations, type.Color };
            type.Name = name;
            type.NameTranslations = nameTranslations;
            type.Description = description;
            type.DescriptionTranslations = descriptionTranslations;
            type.Color = color;
            Audit(adminId, "itemType.update", new { itemTypeId = id, before, after = new { name, nameTranslations, description, descriptionTranslations, color } });
            await _db.SaveChangesAsync();
            return await GetAsync(id);
        }

        public async Task DeleteAsync(Guid adminId, int id)
        {
            var type = await _db.CollectionTypes.FirstOrDefaultAsync(t => t.Id == id) ?? throw TypeNotFound();
            if (type.Published)
                throw MarketplaceException.Conflict("itemTypePublished", "Unpublish the item type before deleting it.");
            var collections = await _db.Collections.CountAsync(c => c.CollectionTypeId == id);
            var listings = await _db.Listings.CountAsync(l => l.CollectionTypeId == id);
            if (collections > 0 || listings > 0)
                throw MarketplaceException.Conflict("itemTypeInUse", $"Used by {collections} collection(s) and {listings} listing(s); it can't be deleted.",
                    ErrorArgs.Of($"{collections}", $"{listings}"));

            _db.Attributes.RemoveRange(await _db.Attributes.Where(a => a.CollectionTypeId == id).ToListAsync());
            _db.CollectionTypes.Remove(type);
            Audit(adminId, "itemType.delete", new { itemTypeId = id, type.Name });
            await _db.SaveChangesAsync();
            // Its files belong to nobody else (names carry the type id).
            _files.DeleteIcon(type.Icon);
            _files.DeleteModels(id);
        }

        // ------------------------------------------------------------------ icon and AI models

        public async Task<AdminItemTypeDto> SetIconAsync(Guid adminId, int id, Microsoft.AspNetCore.Http.IFormFile? file)
        {
            var type = await _db.CollectionTypes.FirstOrDefaultAsync(t => t.Id == id) ?? throw TypeNotFound();
            if (file == null) throw MarketplaceException.Validation("invalidIcon", "Choose the icon picture.");
            var old = type.Icon;
            var name = await _files.SaveIconAsync(id, file, _clock.UtcNow);
            type.Icon = name;
            Audit(adminId, "itemType.icon", new { itemTypeId = id, before = old, after = name });
            try
            {
                await _db.SaveChangesAsync();
            }
            catch
            {
                _files.DeleteIcon(name);
                throw;
            }
            if (!string.IsNullOrEmpty(old) && old != name) _files.DeleteIcon(old);
            return await GetAsync(id);
        }

        public async Task<AdminItemTypeDto> SetModelsAsync(Guid adminId, int id, Microsoft.AspNetCore.Http.IFormFile? detection,
            Microsoft.AspNetCore.Http.IFormFile? embedding, int? classCount)
        {
            if (!await _db.CollectionTypes.AnyAsync(t => t.Id == id)) throw TypeNotFound();
            var saved = await _files.SaveModelsAsync(id, detection, embedding, classCount);
            Audit(adminId, "itemType.models", new
            {
                itemTypeId = id,
                detection = detection == null ? null : saved.Detection?.FileName,
                detectionBytes = detection?.Length,
                detectionSha256 = saved.DetectionSha256,
                embedding = embedding == null ? null : saved.Embedding?.FileName,
                embeddingBytes = embedding?.Length,
                embeddingSha256 = saved.EmbeddingSha256,
            });
            await _db.SaveChangesAsync();
            return await GetAsync(id);
        }

        // ------------------------------------------------------------------ attributes

        public async Task<AdminAttributeDto> AddAttributeAsync(Guid adminId, int typeId, AttributeInput input)
        {
            if (!await _db.CollectionTypes.AnyAsync(t => t.Id == typeId)) throw TypeNotFound();
            if (await _db.Attributes.CountAsync(a => a.CollectionTypeId == typeId) >= MaxAttributes)
                throw MarketplaceException.Validation("tooManyAttributes", $"An item type can have at most {MaxAttributes} attributes.");
            var (name, translations) = await ValidateAttributeAsync(typeId, null, input);

            var attribute = new Attribute
            {
                CollectionTypeId = typeId,
                Name = name,
                NameTranslations = translations,
                DataType = input.DataType,
                Primary = input.Primary,
                Required = input.Required,
                ItemOptionsId = input.OptionSetId,
            };
            if (input.Primary) await ClearPrimaryAsync(typeId, null);
            _db.Attributes.Add(attribute);
            await _db.SaveChangesAsync();
            Audit(adminId, "attribute.create", new { itemTypeId = typeId, attributeId = attribute.Id, name, dataType = input.DataType, input.Primary, input.Required, input.OptionSetId });
            await _db.SaveChangesAsync();
            return ToDto(attribute, 0);
        }

        public async Task<AdminAttributeDto> UpdateAttributeAsync(Guid adminId, int attributeId, AttributeInput input)
        {
            var attribute = await _db.Attributes.FirstOrDefaultAsync(a => a.Id == attributeId) ?? throw AttributeNotFound();
            var (name, translations) = await ValidateAttributeAsync(attribute.CollectionTypeId, attributeId, input);
            var used = await UsedByItemsAsync(attributeId);
            if (used > 0 && (input.DataType != attribute.DataType || input.OptionSetId != attribute.ItemOptionsId))
                throw InUse(used);

            var before = new { attribute.Name, attribute.NameTranslations, dataType = attribute.DataType, attribute.Primary, attribute.Required, optionSetId = attribute.ItemOptionsId };
            if (input.Primary && !attribute.Primary) await ClearPrimaryAsync(attribute.CollectionTypeId, attributeId);
            attribute.Name = name;
            attribute.NameTranslations = translations;
            attribute.DataType = input.DataType;
            attribute.Primary = input.Primary;
            attribute.Required = input.Required;
            attribute.ItemOptionsId = input.OptionSetId;
            Audit(adminId, "attribute.update", new { itemTypeId = attribute.CollectionTypeId, attributeId, before, after = new { name, translations, dataType = input.DataType, input.Primary, input.Required, input.OptionSetId } });
            await _db.SaveChangesAsync();
            return ToDto(attribute, used);
        }

        public async Task DeleteAttributeAsync(Guid adminId, int attributeId)
        {
            var attribute = await _db.Attributes.FirstOrDefaultAsync(a => a.Id == attributeId) ?? throw AttributeNotFound();
            var used = await UsedByItemsAsync(attributeId);
            if (used > 0) throw InUse(used);
            _db.Attributes.Remove(attribute);
            Audit(adminId, "attribute.delete", new { itemTypeId = attribute.CollectionTypeId, attributeId, attribute.Name });
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ helpers

        private static (string Name, Dictionary<string, string> NameTranslations, string Description, Dictionary<string, string> DescriptionTranslations, string Color)
            Validate(ItemTypeInput input)
        {
            var name = Text.Required(input.Name, 1, MaxName, "Name");
            var description = Text.Optional(input.Description, MaxDescription, "Description") ?? "";
            var color = (input.Color ?? "").Trim();
            if (!Color.IsMatch(color))
                throw MarketplaceException.Validation("invalidColor", "Colour must be like #A98D3C.");
            return (name, Translations.Validate(input.NameTranslations, MaxName), description,
                Translations.Validate(input.DescriptionTranslations, MaxDescription), color.ToUpperInvariant());
        }

        private async Task EnsureTypeNameFreeAsync(string name, int? exceptId)
        {
            var lower = name.ToLower();
            if (await _db.CollectionTypes.AnyAsync(t => t.Id != exceptId && t.Name.ToLower() == lower))
                throw MarketplaceException.Conflict("itemTypeNameTaken", "Another item type already has this name.");
        }

        private async Task<(string Name, Dictionary<string, string> Translations)> ValidateAttributeAsync(int typeId, int? exceptId, AttributeInput input)
        {
            var name = Text.Required(input.Name, 1, MaxName, "Name");
            var translations = Translations.Validate(input.NameTranslations, MaxName);
            if (!Enum.IsDefined(input.DataType))
                throw MarketplaceException.Validation("unknownDataType", "Unknown data type.");
            var lower = name.ToLower();
            if (await _db.Attributes.AnyAsync(a => a.CollectionTypeId == typeId && a.Id != exceptId && a.Name.ToLower() == lower))
                throw MarketplaceException.Conflict("attributeNameTaken", "This item type already has an attribute with this name.");

            var needsOptions = OptionTypes.Contains(input.DataType);
            if (needsOptions && input.OptionSetId == null)
                throw MarketplaceException.Validation("optionSetRequired", "Choose the option set this attribute picks from.");
            if (!needsOptions && input.OptionSetId != null)
                throw MarketplaceException.Validation("optionSetNotAllowed", "Only select, multi-select and autocomplete attributes use an option set.");
            if (input.OptionSetId is { } setId && !await _db.ItemOptions.AnyAsync(o => o.Id == setId))
                throw MarketplaceException.NotFound("optionSetNotFound", "Option set not found.");
            return (name, translations);
        }

        /// <summary>One primary attribute per type: it names the items.</summary>
        private async Task ClearPrimaryAsync(int typeId, int? exceptId)
        {
            foreach (var other in await _db.Attributes.Where(a => a.CollectionTypeId == typeId && a.Primary && a.Id != exceptId).ToListAsync())
                other.Primary = false;
        }

        private Task<int> UsedByItemsAsync(int attributeId) =>
            _db.ItemAttributes.Where(v => v.AttributeId == attributeId).Select(v => v.ItemId).Distinct().CountAsync();

        private void Audit(Guid adminId, string action, object details) =>
            AdminAudit.Add(_db, adminId, action, action.Split('.')[0], null, details, _clock.UtcNow);

        private static AdminAttributeDto ToDto(Attribute a, int used) =>
            new(a.Id, a.Name, a.NameTranslations, a.DataType, a.Primary, a.Required, a.ItemOptionsId, used);

        private static MarketplaceException InUse(int used) =>
            MarketplaceException.Conflict("attributeInUse", $"{used} item(s) have a value for this attribute: it can't be deleted or change its data type or option set.",
                ErrorArgs.Of($"{used}"));

        private static MarketplaceException TypeNotFound() => MarketplaceException.NotFound("itemTypeNotFound", "Item type not found.");

        private static MarketplaceException AttributeNotFound() => MarketplaceException.NotFound("attributeNotFound", "Attribute not found.");
    }
}
