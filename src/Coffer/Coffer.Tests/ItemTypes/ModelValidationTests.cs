using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Coffer.BusinessLogic.ItemTypes;
using Coffer.BusinessLogic.Moderation;
using Coffer.Domain.Constants;
using Coffer.Domain.Entities;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.ItemTypes
{
    /// <summary>Records what was validated and answers as configured.</summary>
    public sealed class FakeModelValidator : IModelValidator
    {
        public bool Ok { get; set; } = true;
        public List<(string FileName, string Kind)> Calls { get; } = new();

        public Task<ModelValidation> ValidateAsync(string fileName, string kind, CancellationToken ct = default)
        {
            lock (Calls) Calls.Add((fileName, kind));
            return Task.FromResult(new ModelValidation(Ok, Ok ? null : "cannot load"));
        }
    }

    /// <summary>An uploaded model replaces the live one only after the AI service has loaded it.</summary>
    [Collection("api")]
    public class ModelValidationTests : IDisposable
    {
        private readonly ApiFactory _api = new();
        private readonly FakeModelValidator _validator = new();
        private TestDb Db => _api.Db;
        private readonly Coffer.Domain.Moderation.ManagerAdmin _admin;

        public ModelValidationTests()
        {
            _api.Overrides = services =>
            {
                services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
                services.AddSingleton<IModelValidator>(_validator);
            };
            _admin = Db.AddManagerAdmin("1001");
        }

        private HttpClient Admin() => _api.ManagerClientFor(_admin);

        private int NewType()
        {
            var type = new CollectionTypeProvided($"Type {Guid.NewGuid():N}", "desc", "#FFFFFF", "") { Id = Random.Shared.Next(100_000, 2_000_000_000) };
            Db.Context.CollectionTypes.Add(type);
            Db.Context.SaveChanges();
            return type.Id;
        }

        private static byte[] Model(byte fill) => ItemTypeFilesTests.Model().Select((b, i) => i < 4 ? b : fill).ToArray();

        private Task<HttpResponseMessage> Upload(int typeId, byte[]? detection, byte[]? embedding, int classCount = 60)
        {
            var form = new MultipartFormDataContent();
            void Add(string field, byte[] bytes)
            {
                var part = new ByteArrayContent(bytes);
                part.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
                form.Add(part, field, field + ".pt");
            }
            if (detection != null) Add("detection", detection);
            if (embedding != null) Add("embedding", embedding);
            form.Add(new StringContent(classCount.ToString()), "classCount");
            return Admin().PostAsync($"api/Admin/ItemTypes/{typeId}/Models", form);
        }

        private static string ModelFile(string name) => Path.Combine(ItemTypeFiles.ModelsFolder, name);

        private static async Task<string> Code(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("code").GetString()!;

        [Fact]
        public async Task RejectedModelIsNotPublished()
        {
            var id = NewType();
            _validator.Ok = false;

            var response = await Upload(id, Model(1), Model(2));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("modelInvalid", await Code(response));
            Assert.False(File.Exists(ModelFile($"{id}_detection.pt")));
            Assert.False(File.Exists(ModelFile($"{id}_similarity_60.pt")));
            Assert.Empty(Directory.GetFiles(ItemTypeFiles.ModelsFolder, $"{id}_*"));
        }

        [Fact]
        public async Task RejectedModelKeepsThePreviousFile()
        {
            var id = NewType();
            Assert.Equal(HttpStatusCode.OK, (await Upload(id, Model(7), null)).StatusCode);

            _validator.Ok = false;
            Assert.Equal(HttpStatusCode.BadRequest, (await Upload(id, Model(9), null)).StatusCode);

            Assert.Equal(Model(7), File.ReadAllBytes(ModelFile($"{id}_detection.pt")));
            Assert.Single(Directory.GetFiles(ItemTypeFiles.ModelsFolder, $"{id}_*"));
        }

        [Fact]
        public async Task AcceptedModelReplacesTheOld()
        {
            var id = NewType();
            await Upload(id, null, Model(3), classCount: 10);
            var response = await Upload(id, null, Model(4), classCount: 12);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(Model(4), File.ReadAllBytes(ModelFile($"{id}_similarity_12.pt")));
            Assert.False(File.Exists(ModelFile($"{id}_similarity_10.pt")));
        }

        [Fact]
        public async Task ValidatorSeesCandidateNames()
        {
            var id = NewType();
            await Upload(id, Model(1), Model(2));

            Assert.Contains(($"{id}_detection.pt.candidate", "detection"), _validator.Calls);
            Assert.Contains(($"{id}_similarity_60.pt.candidate", "embedding"), _validator.Calls);
        }

        [Fact]
        public async Task ModelDownloadServesTheFile()
        {
            var id = NewType();
            await Upload(id, Model(5), Model(6));

            var detection = await Admin().GetAsync($"api/Admin/ItemTypes/{id}/Models/detection");
            var embedding = await Admin().GetAsync($"api/Admin/ItemTypes/{id}/Models/embedding");
            var missing = await Admin().GetAsync($"api/Admin/ItemTypes/{NewType()}/Models/detection");
            var unknownKind = await Admin().GetAsync($"api/Admin/ItemTypes/{id}/Models/icon");

            Assert.Equal(Model(5), await detection.Content.ReadAsByteArrayAsync());
            Assert.Equal(Model(6), await embedding.Content.ReadAsByteArrayAsync());
            Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
            Assert.Equal("modelNotFound", await Code(missing));
            Assert.Equal(HttpStatusCode.NotFound, unknownKind.StatusCode);
        }

        [Fact]
        public async Task ModelDownloadIsAdminOnly()
        {
            var id = NewType();
            var roleAdmin = Db.AddUser("legacy-admin", UserRole.Admin);
            var former = Db.AddManagerAdmin("2002", "former");
            var url = $"api/Admin/ItemTypes/{id}/Models/detection";

            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(null).GetAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, (await _api.ClientFor(roleAdmin).GetAsync(url)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await _api.ManagerClientFor(former).GetAsync(url)).StatusCode);
        }

        public void Dispose() => _api.Dispose();
    }
}
