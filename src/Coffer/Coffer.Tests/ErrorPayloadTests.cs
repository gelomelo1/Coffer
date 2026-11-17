using System.Text.Json;
using Coffer.ASPNET.Extensions;
using Coffer.BusinessLogic.Marketplace.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;

namespace Coffer.Tests
{
    /// <summary>Every API error carries a stable code (+ params) the app translates, next to the English message.</summary>
    public class ErrorPayloadTests
    {
        private static JsonElement Json(object? value) => JsonSerializer.SerializeToElement(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        private static ObjectResult Filter(Exception ex)
        {
            var actionContext = new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor());
            var context = new ExceptionContext(actionContext, new List<IFilterMetadata>()) { Exception = ex };
            new MarketplaceExceptionFilter().OnException(context);
            Assert.True(context.ExceptionHandled);
            return Assert.IsType<ObjectResult>(context.Result);
        }

        [Fact]
        public void ExceptionFilter_WritesCode_Params_AndEnglishMessage()
        {
            var result = Filter(MarketplaceException.NotFound("listingNotFound", "Listing 42 not found", ErrorArgs.Of("42")));

            Assert.Equal(StatusCodes.Status404NotFound, result.StatusCode);
            var json = Json(result.Value);
            Assert.Equal("listingNotFound", json.GetProperty("code").GetString());
            Assert.Equal("42", json.GetProperty("params").GetProperty("p0").GetString());
            Assert.Equal("Listing 42 not found", json.GetProperty("message").GetString());
        }

        [Fact]
        public void ExceptionFilter_OmitsParams_WhenThereAreNone()
        {
            var json = Json(Filter(MarketplaceException.Conflict("onlyActiveListingsCanBeArchived", "Only active listings can be archived.")).Value);

            Assert.Equal("onlyActiveListingsCanBeArchived", json.GetProperty("code").GetString());
            Assert.False(json.TryGetProperty("params", out var p) && p.ValueKind != JsonValueKind.Null);
        }

        private sealed class TestController : ControllerBase { }

        [Fact]
        public void ControllerHelper_WritesTheSamePayload()
        {
            var result = new TestController().ApiError(StatusCodes.Status400BadRequest, "searchTextCannotBeEmpty", "Search text cannot be empty.");

            Assert.Equal(StatusCodes.Status400BadRequest, result.StatusCode);
            var json = Json(result.Value);
            Assert.Equal("searchTextCannotBeEmpty", json.GetProperty("code").GetString());
            Assert.Equal("Search text cannot be empty.", json.GetProperty("message").GetString());
        }

        [Fact]
        public void ErrorArgs_NumberParamsInOrder()
        {
            var args = ErrorArgs.Of("a", "b");
            Assert.Equal("a", args["p0"]);
            Assert.Equal("b", args["p1"]);
        }
    }
}
