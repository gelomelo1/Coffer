using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.BusinessLogic.Moderation;
using Coffer.Domain.Entities;
using Coffer.Tests.Marketplace;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Contribution
{
    /// <summary>API fixture for Shape What's Next: a Manager admin, a controllable clock and helpers for phases and votes.</summary>
    public abstract class ContributionTestBase : IDisposable
    {
        protected readonly ApiFactory Api = new();
        protected TestDb Db => Api.Db;
        /// <summary>Starts at the real time: session and Manager tokens are checked against it.</summary>
        protected readonly FakeClock Clock = new() { UtcNow = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc) };
        protected readonly Coffer.Domain.Moderation.ManagerAdmin AdminIdentity;
        private HttpClient? _admin;

        protected ContributionTestBase()
        {
            Api.Overrides = services =>
            {
                services.AddSingleton(ManagerAdminConfig.Parse("[\"1001\"]"));
                services.AddSingleton<IClock>(Clock);
            };
            AdminIdentity = Db.AddManagerAdmin("1001");
        }

        protected HttpClient Admin() => _admin ??= Api.ManagerClientFor(AdminIdentity);

        /// <summary>
        /// A signed-in app client. Its token is issued at the real time (token lifetimes are checked against it), even
        /// when a test has moved the clock on.
        /// </summary>
        protected HttpClient UserClient(User user)
        {
            var moved = Clock.UtcNow;
            Clock.UtcNow = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc);
            try { return Api.ClientFor(user); }
            finally { Clock.UtcNow = moved; }
        }

        protected User NewUser() => Db.AddUser("u" + Guid.NewGuid().ToString("N")[..8]);

        protected static async Task<JsonElement> Json(HttpResponseMessage response) =>
            JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

        protected static async Task<string> Code(HttpResponseMessage response) => (await Json(response)).GetProperty("code").GetString()!;

        protected static async Task<JsonElement> Ok(HttpResponseMessage response)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.True(response.StatusCode == HttpStatusCode.OK, $"{(int)response.StatusCode}: {body}");
            return JsonDocument.Parse(body).RootElement;
        }

        protected static object Candidates(string a = "Coins", string b = "Stamps", string c = "Pins") => new[]
        {
            new { name = a, nameTranslations = new Dictionary<string, string> { ["hu"] = a + " (hu)" }, description = a + " description", descriptionTranslations = new Dictionary<string, string>() },
            new { name = b, nameTranslations = new Dictionary<string, string> { ["hu"] = "Bélyeg" }, description = b + " description", descriptionTranslations = new Dictionary<string, string>() },
            new { name = c, nameTranslations = new Dictionary<string, string>(), description = "", descriptionTranslations = new Dictionary<string, string>() },
        };

        /// <summary>A voting draft ending in <paramref name="endsIn"/> (default 7 days); answers its id and candidate ids in position order.</summary>
        protected async Task<(Guid Id, Guid[] Candidates)> CreateVote(TimeSpan? endsIn = null)
        {
            var phase = await Ok(await Admin().PostAsJsonAsync("api/Admin/Contribution/Phases",
                new { kind = "vote", endsAt = Clock.UtcNow + (endsIn ?? TimeSpan.FromDays(7)), candidates = Candidates() }));
            var ids = phase.GetProperty("candidates").EnumerateArray().Select(c => c.GetProperty("id").GetGuid()).ToArray();
            return (phase.GetProperty("id").GetGuid(), ids);
        }

        protected async Task<Guid> CreatePhoto(Guid sourcePhaseId, TimeSpan? endsIn = null)
        {
            var phase = await Ok(await Admin().PostAsJsonAsync("api/Admin/Contribution/Phases",
                new { kind = "photo", endsAt = Clock.UtcNow + (endsIn ?? TimeSpan.FromDays(7)), sourcePhaseId }));
            return phase.GetProperty("id").GetGuid();
        }

        protected Task<HttpResponseMessage> Enable(Guid phaseId) =>
            Admin().PutAsJsonAsync("api/Admin/Contribution/Settings", new { enabled = true, reason = (string?)null, activePhaseId = phaseId });

        protected Task<HttpResponseMessage> Disable(string? reason) =>
            Admin().PutAsJsonAsync("api/Admin/Contribution/Settings", new { enabled = false, reason, activePhaseId = (Guid?)null });

        protected async Task<JsonElement> Phase(Guid id) => await Ok(await Admin().GetAsync($"api/Admin/Contribution/Phases/{id}"));

        protected async Task<JsonElement> Settings() => await Ok(await Admin().GetAsync("api/Admin/Contribution/Settings"));

        /// <summary>Votes written straight to the database (the voting route has its own tests).</summary>
        protected void AddVotes(Guid phaseId, Guid candidateId, int count)
        {
            for (var i = 0; i < count; i++)
            {
                var user = NewUser();
                Db.Context.ContributionVotes.Add(new ContributionVote
                {
                    PhaseId = phaseId, UserId = user.Id, CandidateId = candidateId, Text = "Year, mint mark and metal please.",
                    CreatedAt = Clock.UtcNow, UpdatedAt = Clock.UtcNow,
                });
            }
            Db.Context.SaveChanges();
        }

        /// <summary>An opened voting phase with these votes, closed by its end date passing: answers its id and candidates.</summary>
        protected async Task<(Guid Id, Guid[] Candidates)> ClosedVote(params int[] votes)
        {
            var (id, candidates) = await CreateVote(TimeSpan.FromHours(1));
            Assert.Equal(HttpStatusCode.OK, (await Enable(id)).StatusCode);
            for (var i = 0; i < votes.Length; i++) AddVotes(id, candidates[i], votes[i]);
            Clock.Advance(TimeSpan.FromHours(2));
            await Settings(); // any contribution request settles due phases
            return (id, candidates);
        }

        public void Dispose() => Api.Dispose();
    }
}
