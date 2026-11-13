using System.Collections;
using System.Reflection;
using System.Security.Claims;
using System.Text.Json.Serialization;
using Coffer.DataAccess;
using Coffer.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace Coffer.ASPNET.Extensions
{
    /// <summary>
    /// Runs before every controller result is serialized and removes data that belongs only to its owner:
    ///  - ItemProvided.PrivateNote is kept only for the owner of the item's collection,
    ///  - UserProvided.Email is kept only for the user themself.
    /// Items and users appear nested in many responses (feed, search, trades, offers, reactions ...),
    /// so the whole response object graph is walked instead of patching every endpoint.
    /// </summary>
    public class SensitiveDataRedactionFilter : IAsyncResultFilter
    {
        private const int MaxDepth = 32;
        private readonly CofferDbContext _dbContext;

        public SensitiveDataRedactionFilter(CofferDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
        {
            if (context.Result is ObjectResult { Value: not null } result)
            {
                var currentUserId = Guid.TryParse(context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
                    ? id
                    : (Guid?)null;

                var users = new List<UserProvided>();
                var items = new List<ItemProvided>();
                Collect(result.Value, new HashSet<object>(ReferenceEqualityComparer.Instance), users, items, 0);

                foreach (var user in users.Where(u => u.Id != currentUserId))
                {
                    user.Email = null!;
                }

                var itemsWithNotes = items.Where(i => i.PrivateNote != null).ToList();
                if (itemsWithNotes.Count > 0)
                {
                    var itemIds = itemsWithNotes.Select(i => i.Id).Distinct().ToList();
                    var owners = await _dbContext.Items
                        .AsNoTracking()
                        .Where(i => itemIds.Contains(i.Id))
                        .Select(i => new { i.Id, OwnerId = i.Collection.UserId })
                        .ToDictionaryAsync(x => x.Id, x => x.OwnerId);

                    foreach (var item in itemsWithNotes)
                    {
                        if (currentUserId == null || !owners.TryGetValue(item.Id, out var ownerId) || ownerId != currentUserId)
                        {
                            item.PrivateNote = null;
                        }
                    }
                }
            }

            await next();
        }

        private static void Collect(object? value, HashSet<object> visited, List<UserProvided> users, List<ItemProvided> items, int depth)
        {
            if (value == null || depth > MaxDepth)
                return;

            var type = value.GetType();
            if (type.IsPrimitive || type.IsEnum || value is string || value is DateTime || value is Guid || value is decimal)
                return;

            if (!visited.Add(value))
                return;

            if (value is UserProvided user)
                users.Add(user);

            if (value is ItemProvided item)
                items.Add(item);

            if (value is IEnumerable enumerable)
            {
                foreach (var element in enumerable)
                    Collect(element, visited, users, items, depth + 1);
                return;
            }

            // Only walk our own types (entities, DTOs, controller response records).
            if (type.Namespace == null || !type.Namespace.StartsWith("Coffer", StringComparison.Ordinal))
                return;

            foreach (var property in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (!property.CanRead || property.GetIndexParameters().Length > 0)
                    continue;

                // Not serialized anyway; skipping also avoids walking back-references.
                if (property.GetCustomAttribute<JsonIgnoreAttribute>() != null)
                    continue;

                Collect(property.GetValue(value), visited, users, items, depth + 1);
            }
        }
    }
}
