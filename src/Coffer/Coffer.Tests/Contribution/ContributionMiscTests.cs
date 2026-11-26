using System.Net;
using System.Net.Http.Headers;
using Coffer.Tests.ItemTypes;

namespace Coffer.Tests.Contribution
{
    /// <summary>The example galleries (filled by hand on the server) and account deletion.</summary>
    [Collection("api")]
    public class ContributionMiscTests : ContributionTestBase
    {
        private static string Store => Path.Combine(TestEnvironment.Root, "data", "contributions");
        private static string Examples(string form) => Path.Combine(Store, "examples", form);

        private static void ResetExamples()
        {
            if (Directory.Exists(Path.Combine(Store, "examples"))) Directory.Delete(Path.Combine(Store, "examples"), recursive: true);
        }

        [Fact]
        public async Task ExamplesListsImagesInFileNameOrder()
        {
            ResetExamples();
            Directory.CreateDirectory(Examples("detection"));
            File.WriteAllBytes(Path.Combine(Examples("detection"), "02_b.jpg"), ItemTypeFilesTests.Jpeg());
            File.WriteAllBytes(Path.Combine(Examples("detection"), "01_a.png"), ItemTypeFilesTests.Jpeg());
            File.WriteAllText(Path.Combine(Examples("detection"), "notes.txt"), "not an image");

            var examples = await Ok(await UserClient(NewUser()).GetAsync("api/Contribution/Examples"));

            Assert.Equal(new[] { "01_a.png", "02_b.jpg" }, examples.GetProperty("detection").EnumerateArray().Select(e => e.GetString()));
            Assert.Empty(examples.GetProperty("classification").EnumerateArray());
        }

        [Fact]
        public async Task ExampleImageIsServed()
        {
            ResetExamples();
            Directory.CreateDirectory(Examples("classification"));
            var bytes = ItemTypeFilesTests.Jpeg(40, 30);
            File.WriteAllBytes(Path.Combine(Examples("classification"), "01_angles.jpg"), bytes);

            var response = await UserClient(NewUser()).GetAsync("api/Contribution/Examples/classification/01_angles.jpg");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(bytes, await response.Content.ReadAsByteArrayAsync());
            Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
            Assert.Contains("nosniff", response.Headers.GetValues("X-Content-Type-Options"));
        }

        [Theory]
        [InlineData("detection", "..%2F..%2Fsecret.jpg")]
        [InlineData("detection", "a.exe")]
        [InlineData("other", "01_a.jpg")]
        public async Task ExampleFileNamesAreStrict(string form, string fileName)
        {
            ResetExamples();
            Directory.CreateDirectory(Examples("detection"));
            File.WriteAllBytes(Path.Combine(Examples("detection"), "01_a.jpg"), ItemTypeFilesTests.Jpeg());
            File.WriteAllBytes(Path.Combine(Examples("detection"), "a.exe"), new byte[] { 1 });

            var response = await UserClient(NewUser()).GetAsync($"api/Contribution/Examples/{form}/{fileName}");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task MissingExamplesFolderGivesEmptyLists()
        {
            ResetExamples();

            var examples = await Ok(await UserClient(NewUser()).GetAsync("api/Contribution/Examples"));

            Assert.Empty(examples.GetProperty("detection").EnumerateArray());
            Assert.Empty(examples.GetProperty("classification").EnumerateArray());
        }

        [Fact]
        public async Task DeletingAnAccountRemovesItsContributions()
        {
            var (vote, candidates) = await CreateVote();
            await Ok(await Enable(vote));
            var leaver = NewUser();
            var stayer = NewUser();
            foreach (var user in new[] { leaver, stayer })
                await Ok(await UserClient(user).PutAsync("api/Contribution/Vote",
                    JsonContent(new { phaseId = vote, candidateId = candidates[0], text = "Year and mint mark, please." })));
            await Ok(await Admin().PostAsync($"api/Admin/Contribution/Phases/{vote}/Close", JsonContent(new { })));
            var photo = await CreatePhoto(vote);
            await Ok(await Enable(photo));
            foreach (var user in new[] { leaver, stayer })
            {
                await Ok(await UserClient(user).PostAsync("api/Contribution/Detection", Upload(photo, 2)));
                await Ok(await UserClient(user).PostAsync("api/Contribution/Classification", Upload(photo, 5)));
            }
            var leaverForm = Db.NewContext().ContributionForms.Single(f => f.UserId == leaver.Id).Id;

            Assert.Equal(HttpStatusCode.NoContent, (await UserClient(leaver).DeleteAsync("api/Account")).StatusCode);

            using var fresh = Db.NewContext();
            Assert.Empty(fresh.ContributionVotes.Where(v => v.UserId == leaver.Id));
            Assert.Empty(fresh.ContributionForms.Where(f => f.UserId == leaver.Id));
            Assert.Empty(fresh.ContributionUploads.Where(u => u.UserId == leaver.Id));
            Assert.Single(fresh.ContributionVotes.Where(v => v.UserId == stayer.Id));
            Assert.Equal(7, fresh.ContributionUploads.Count(u => u.UserId == stayer.Id));
            Assert.Equal(candidates[0], fresh.ContributionPhases.Single(p => p.Id == vote).WinnerCandidateId);
            Assert.False(Directory.Exists(Path.Combine(Store, photo.ToString(), "classification", leaverForm.ToString())));
            Assert.Equal(2, Directory.GetFiles(Path.Combine(Store, photo.ToString(), "detection")).Length);
        }

        private static StringContent JsonContent(object body) =>
            new(System.Text.Json.JsonSerializer.Serialize(body), System.Text.Encoding.UTF8, "application/json");

        private static MultipartFormDataContent Upload(Guid phaseId, int count)
        {
            var form = new MultipartFormDataContent { { new StringContent(phaseId.ToString()), "phaseId" } };
            for (var i = 0; i < count; i++)
            {
                var part = new ByteArrayContent(ItemTypeFilesTests.Jpeg(64, 48));
                part.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
                form.Add(part, "images", $"p{i}.jpg");
            }
            return form;
        }
    }
}
