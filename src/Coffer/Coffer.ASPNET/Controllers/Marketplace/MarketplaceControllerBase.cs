using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Marketplace;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Coffer.ASPNET.Controllers.Marketplace
{
    /// <summary>
    /// For actions that read their multipart form by hand (OptionalFormAsync): stops MVC from eagerly parsing the
    /// form during model binding, which turns an empty form into an automatic 400.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method)]
    public sealed class ManualFormAttribute : Attribute, IResourceFilter
    {
        public void OnResourceExecuting(ResourceExecutingContext context)
        {
            context.ValueProviderFactories.RemoveType<FormValueProviderFactory>();
            context.ValueProviderFactories.RemoveType<FormFileValueProviderFactory>();
            context.ValueProviderFactories.RemoveType<JQueryFormValueProviderFactory>();
        }

        public void OnResourceExecuted(ResourceExecutedContext context) { }
    }

    /// <summary>Common plumbing: authenticated caller id and parsing helpers. Business rules live in the services.</summary>
    [ApiController]
    [Authorize]
    public abstract class MarketplaceControllerBase : BaseController
    {
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        /// <summary>Caller id from the JWT; [Authorize] guarantees it exists for real tokens.</summary>
        protected Guid Me => UserId ?? throw MarketplaceException.Forbidden("notSignedIn", "Not signed in.");

        protected static T ParsePayload<T>(string? payload)
        {
            if (string.IsNullOrWhiteSpace(payload)) throw MarketplaceException.Validation("missingPayload", "Missing payload.");
            try
            {
                return JsonSerializer.Deserialize<T>(payload, Json) ?? throw MarketplaceException.Validation("missingPayload", "Missing payload.");
            }
            catch (JsonException)
            {
                throw MarketplaceException.Validation("malformedPayload", "Malformed payload.");
            }
        }

        /// <summary>
        /// Reads an optional multipart form by hand. An empty or missing form (e.g. "no photo") must not fail the
        /// request, which MVC form binding does for bodies with zero parts.
        /// </summary>
        protected async Task<IFormCollection> OptionalFormAsync()
        {
            if (!Request.HasFormContentType) return FormCollection.Empty;
            try
            {
                return await Request.ReadFormAsync();
            }
            catch (InvalidDataException)
            {
                return FormCollection.Empty;
            }
        }

        protected static TEnum? ParseEnum<TEnum>(string? text, string field) where TEnum : struct, Enum
        {
            if (string.IsNullOrWhiteSpace(text)) return null;
            try { return EnumText.FromSnake<TEnum>(text.Trim().ToLowerInvariant()); }
            catch (ArgumentException) { throw MarketplaceException.Validation("unknown", $"Unknown {field}.", ErrorArgs.Of($"{field}")); }
        }
    }
}
