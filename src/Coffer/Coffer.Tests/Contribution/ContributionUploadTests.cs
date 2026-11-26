using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Coffer.Domain.Entities;
using Coffer.Tests.Images;
using Coffer.Tests.ItemTypes;
using SixLabors.ImageSharp;

namespace Coffer.Tests.Contribution
{
    /// <summary>Photo phases: detection photos into one pool, classification forms into one folder each.</summary>
    [Collection("api")]
    public class ContributionUploadTests : ContributionTestBase
    {
        private static string Store => Path.Combine(TestEnvironment.Root, "data", "contributions");

        private static MultipartFormDataContent Form(Guid phaseId, IEnumerable<byte[]> photos)
        {
            var form = new MultipartFormDataContent { { new StringContent(phaseId.ToString()), "phaseId" } };
            var i = 0;
            foreach (var bytes in photos)
            {
                var part = new ByteArrayContent(bytes);
                part.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
                form.Add(part, "images", $"photo{i++}.jpg");
            }
            return form;
        }

        private static IEnumerable<byte[]> Photos(int n) => Enumerable.Range(0, n).Select(_ => ItemTypeFilesTests.Jpeg(64, 48));

        private Task<HttpResponseMessage> Detection(User user, Guid phaseId, IEnumerable<byte[]> photos) =>
            UserClient(user).PostAsync("api/Contribution/Detection", Form(phaseId, photos));

        private Task<HttpResponseMessage> Classification(User user, Guid phaseId, IEnumerable<byte[]> photos) =>
            UserClient(user).PostAsync("api/Contribution/Classification", Form(phaseId, photos));

        /// <summary>A running photo phase for "Stamps" (the winner of a closed vote).</summary>
        private async Task<Guid> RunningPhotoPhase(TimeSpan? endsIn = null)
        {
            var (vote, _) = await ClosedVote(1, 4, 0);
            var photo = await CreatePhoto(vote, endsIn);
            await Ok(await Enable(photo));
            return photo;
        }

        private static string[] Files(string dir) => Directory.Exists(dir) ? Directory.GetFiles(dir) : Array.Empty<string>();

        [Fact]
        public async Task PhotoPhaseShowsCommunityTotals()
        {
            var phase = await RunningPhotoPhase();
            var (anna, bence) = (NewUser(), NewUser());
            await Ok(await Detection(anna, phase, Photos(2)));
            await Ok(await Detection(anna, phase, Photos(1)));
            await Ok(await Classification(bence, phase, Photos(5)));

            var view = (await Ok(await UserClient(NewUser()).GetAsync("api/Contribution"))).GetProperty("phase");

            var totals = view.GetProperty("totals");
            Assert.Equal(3, totals.GetProperty("detectionPhotos").GetInt32());
            Assert.Equal(1, totals.GetProperty("forms").GetInt32());
            Assert.Equal(5, totals.GetProperty("formPhotos").GetInt32());
            Assert.Equal(2, totals.GetProperty("contributors").GetInt32());
            Assert.Equal(JsonValueKind.Null, view.GetProperty("results").ValueKind);
        }

        [Fact]
        public async Task DetectionPhotosLandInThePhasePool()
        {
            var phase = await RunningPhotoPhase();
            var user = NewUser();

            var mine = await Ok(await Detection(user, phase, Photos(3)));

            Assert.Equal(3, mine.GetProperty("detectionPhotos").GetInt32());
            Assert.Equal(3, Files(Path.Combine(Store, phase.ToString(), "detection")).Length);
            var rows = Db.NewContext().ContributionUploads.Where(u => u.PhaseId == phase).ToList();
            Assert.Equal(3, rows.Count);
            Assert.All(rows, r => Assert.Equal(ContributionUploadKind.Detection, r.Kind));
            Assert.All(rows, r => Assert.True(File.Exists(Path.Combine(Store, phase.ToString(), "detection", r.FileName))));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(21)]
        public async Task DetectionNeeds1To20Photos(int count)
        {
            var phase = await RunningPhotoPhase();

            var response = await Detection(NewUser(), phase, Photos(count));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionPhotoCount", await Code(response));
        }

        [Theory]
        [InlineData(4)]
        [InlineData(11)]
        public async Task FormNeeds5To10Photos(int count)
        {
            var phase = await RunningPhotoPhase();

            var response = await Classification(NewUser(), phase, Photos(count));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("formPhotoCount", await Code(response));
        }

        [Fact]
        public async Task FormLandsInItsOwnFolder()
        {
            var phase = await RunningPhotoPhase();
            var user = NewUser();

            var mine = await Ok(await Classification(user, phase, Photos(6)));

            Assert.Equal(1, mine.GetProperty("classificationForms").GetInt32());
            var form = Db.NewContext().ContributionForms.Single(f => f.PhaseId == phase);
            Assert.Equal(6, form.PhotoCount);
            Assert.Equal(6, Files(Path.Combine(Store, phase.ToString(), "classification", form.Id.ToString())).Length);
            Assert.Equal(6, Db.NewContext().ContributionUploads.Count(u => u.FormId == form.Id && u.Kind == ContributionUploadKind.Classification));
        }

        [Fact]
        public async Task BadPhotoInFormStoresNothing()
        {
            var phase = await RunningPhotoPhase();
            var notAnImage = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 1, 2, 3 };

            var response = await Classification(NewUser(), phase, Photos(6).Append(notAnImage));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Empty(Db.NewContext().ContributionForms.Where(f => f.PhaseId == phase));
            Assert.Empty(Db.NewContext().ContributionUploads.Where(u => u.PhaseId == phase));
            Assert.False(Directory.Exists(Path.Combine(Store, phase.ToString(), "classification"))
                         && Directory.EnumerateFileSystemEntries(Path.Combine(Store, phase.ToString(), "classification")).Any());
            var temp = Path.Combine(Store, ".tmp");
            Assert.False(Directory.Exists(temp) && Directory.EnumerateFileSystemEntries(temp).Any());
        }

        [Fact]
        public async Task DailyLimitCountsBothKinds()
        {
            var phase = await RunningPhotoPhase();
            var user = NewUser();
            for (var i = 0; i < 295; i++)
                Db.Context.ContributionUploads.Add(new ContributionUpload
                {
                    Id = Guid.NewGuid(), PhaseId = phase, UserId = user.Id, Kind = ContributionUploadKind.Detection,
                    FileName = $"{Guid.NewGuid():N}.jpg", CreatedAt = Clock.UtcNow,
                });
            Db.Context.SaveChanges();

            var refused = await Classification(user, phase, Photos(6));
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Equal("contributionDailyLimit", await Code(refused));
            await Ok(await Detection(user, phase, Photos(5))); // exactly 300

            Clock.UtcNow = DateTime.SpecifyKind(Clock.UtcNow.Date.AddDays(1).AddMinutes(1), DateTimeKind.Utc);
            await Ok(await Classification(user, phase, Photos(6)));
        }

        [Fact]
        public async Task UploadToVotePhaseIsRefused()
        {
            var (vote, _) = await CreateVote();
            await Ok(await Enable(vote));

            var response = await Detection(NewUser(), vote, Photos(1));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionWrongPhase", await Code(response));
        }

        [Fact]
        public async Task UploadAfterEndIsRefused()
        {
            var phase = await RunningPhotoPhase(TimeSpan.FromHours(1));
            Clock.Advance(TimeSpan.FromHours(1));

            var response = await Detection(NewUser(), phase, Photos(2));

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("contributionClosed", await Code(response));
            Assert.Empty(Files(Path.Combine(Store, phase.ToString(), "detection")));
        }

        [Fact]
        public async Task StoredPhotosAreWidthCappedAndClean()
        {
            var phase = await RunningPhotoPhase();
            var big = ItemTypeFilesTests.Jpeg(2000, 1500);
            var gps = UploadedImagesTests.JpegWithGps(400, 300);

            await Ok(await Detection(NewUser(), phase, new[] { big, gps }));

            var stored = Files(Path.Combine(Store, phase.ToString(), "detection")).Select(f => Image.Load(f)).ToList();
            try
            {
                Assert.Contains(stored, i => i.Width == 800);
                Assert.Contains(stored, i => i.Width == 400);
                Assert.All(stored, i => Assert.Null(i.Metadata.ExifProfile));
            }
            finally { stored.ForEach(i => i.Dispose()); }
        }

        [Fact]
        public async Task UploadsRecordOneActivityEach()
        {
            var phase = await RunningPhotoPhase();
            var user = NewUser();

            await Ok(await Detection(user, phase, Photos(3)));
            await Ok(await Classification(user, phase, Photos(6)));

            var events = Db.NewContext().ActivityEvents.Where(e => e.UserId == user.Id).OrderBy(e => e.OccurredAt).ToList();
            Assert.Equal(new[] { "contribution.photosUploaded", "contribution.formCompleted" }, events.Select(e => e.Kind));
            var uploaded = JsonDocument.Parse(events[0].Details).RootElement;
            Assert.Equal(3, uploaded.GetProperty("count").GetInt32());
            Assert.Equal("Stamps", uploaded.GetProperty("subject").GetString());
            Assert.Equal(6, JsonDocument.Parse(events[1].Details).RootElement.GetProperty("count").GetInt32());
        }
    }
}
