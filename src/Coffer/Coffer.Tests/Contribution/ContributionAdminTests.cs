using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.BusinessLogic.Contribution;
using Microsoft.Extensions.DependencyInjection;

namespace Coffer.Tests.Contribution
{
    /// <summary>Phases and the switch, as the Manager drives them.</summary>
    [Collection("api")]
    public class ContributionAdminTests : ContributionTestBase
    {
        [Fact]
        public async Task EnablingWithADraftOpensIt()
        {
            var (id, _) = await CreateVote();

            await Ok(await Enable(id));

            var phase = await Phase(id);
            Assert.Equal("open", phase.GetProperty("state").GetString());
            Assert.True(phase.GetProperty("active").GetBoolean());
            Assert.Equal(Clock.UtcNow, phase.GetProperty("openedAt").GetDateTime(), TimeSpan.FromSeconds(1));
            var settings = await Settings();
            Assert.True(settings.GetProperty("enabled").GetBoolean());
            Assert.Equal(id, settings.GetProperty("activePhaseId").GetGuid());
        }

        [Fact]
        public async Task EnablingNeedsAnEndDateAtLeast5MinutesAhead()
        {
            var (id, _) = await CreateVote(TimeSpan.FromMinutes(4));

            var response = await Enable(id);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionEndTooSoon", await Code(response));
            Assert.Equal("draft", (await Phase(id)).GetProperty("state").GetString());
        }

        [Fact]
        public async Task EnablingAClosedPhaseIsRefused()
        {
            var (id, _) = await ClosedVote(2, 1, 0);

            var response = await Enable(id);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionPhaseNotOpenable", await Code(response));
        }

        [Fact]
        public async Task OnlyOneOpenPhase()
        {
            var (first, _) = await CreateVote();
            await Ok(await Enable(first));
            await Ok(await Disable("modelsInProgress")); // first stays open, paused
            var (second, _) = await CreateVote();

            var response = await Enable(second);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionOtherPhaseOpen", await Code(response));
            Assert.Equal("draft", (await Phase(second)).GetProperty("state").GetString());
        }

        [Fact]
        public async Task DisablingPausesTheOpenPhase()
        {
            var (id, _) = await CreateVote();
            await Ok(await Enable(id));

            await Ok(await Disable("modelsInProgress"));

            var phase = await Phase(id);
            Assert.Equal("open", phase.GetProperty("state").GetString());
            Assert.False(phase.GetProperty("active").GetBoolean());
            var settings = await Settings();
            Assert.False(settings.GetProperty("enabled").GetBoolean());
            Assert.Equal("modelsInProgress", settings.GetProperty("reason").GetString());

            await Ok(await Enable(id)); // resumes the same phase
            Assert.True((await Phase(id)).GetProperty("active").GetBoolean());
        }

        [Theory]
        [InlineData(null)]
        [InlineData("nope")]
        public async Task DisablingNeedsAReason(string? reason)
        {
            var response = await Disable(reason);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionReasonRequired", await Code(response));
        }

        [Fact]
        public async Task VotePhaseNeedsExactlyThreeCandidates()
        {
            var two = new[] { new { name = "Coins", description = "" }, new { name = "Stamps", description = "" } };

            var response = await Admin().PostAsJsonAsync("api/Admin/Contribution/Phases", new { kind = "vote", candidates = two });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionCandidateCount", await Code(response));
        }

        [Fact]
        public async Task CandidatesLockedOnceOpen()
        {
            var (id, _) = await CreateVote();
            await Ok(await Enable(id));

            var withCandidates = await Admin().PutAsJsonAsync($"api/Admin/Contribution/Phases/{id}",
                new { kind = "vote", endsAt = Clock.UtcNow.AddDays(9), candidates = Candidates("A", "B", "C") });
            Assert.Equal(HttpStatusCode.BadRequest, withCandidates.StatusCode);
            Assert.Equal("contributionPhaseLocked", await Code(withCandidates));

            var later = Clock.UtcNow.AddDays(9);
            await Ok(await Admin().PutAsJsonAsync($"api/Admin/Contribution/Phases/{id}", new { kind = "vote", endsAt = later }));
            Assert.Equal(later, (await Phase(id)).GetProperty("endsAt").GetDateTime(), TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task ExtendingNeedsAnEndAtLeast5MinutesAhead()
        {
            var (id, _) = await CreateVote();
            await Ok(await Enable(id));

            var response = await Admin().PutAsJsonAsync($"api/Admin/Contribution/Phases/{id}", new { kind = "vote", endsAt = Clock.UtcNow.AddMinutes(2) });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionEndTooSoon", await Code(response));
        }

        [Fact]
        public async Task PassingTheEndDateClosesAndSwitchesOff()
        {
            var (id, _) = await CreateVote(TimeSpan.FromHours(1));
            await Ok(await Enable(id));
            var endsAt = (await Phase(id)).GetProperty("endsAt").GetDateTime();

            Clock.Advance(TimeSpan.FromHours(1)); // exactly the end time

            var settings = await Settings();
            Assert.False(settings.GetProperty("enabled").GetBoolean());
            Assert.Equal("justFinished", settings.GetProperty("reason").GetString());
            var phase = await Phase(id);
            Assert.Equal("closed", phase.GetProperty("state").GetString());
            Assert.Equal(endsAt, phase.GetProperty("closedAt").GetDateTime(), TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task ClearLeaderWins()
        {
            var (id, candidates) = await ClosedVote(3, 1, 0);

            var phase = await Phase(id);
            Assert.Equal(candidates[0], phase.GetProperty("winnerCandidateId").GetGuid());
            Assert.False(phase.GetProperty("tie").GetBoolean());
            var counts = phase.GetProperty("candidates").EnumerateArray().Select(c => c.GetProperty("votes").GetInt32()).ToArray();
            Assert.Equal(new[] { 3, 1, 0 }, counts);
            Assert.Equal(0.75, phase.GetProperty("candidates")[0].GetProperty("share").GetDouble(), 3);
        }

        [Fact]
        public async Task TieLeavesNoWinnerAndPickWinnerAcceptsOnlyTiedCandidates()
        {
            var (id, candidates) = await ClosedVote(2, 2, 0);

            var phase = await Phase(id);
            Assert.Equal(JsonValueKind.Null, phase.GetProperty("winnerCandidateId").ValueKind);
            Assert.True(phase.GetProperty("tie").GetBoolean());

            var third = await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Winner", new { candidateId = candidates[2] });
            Assert.Equal(HttpStatusCode.BadRequest, third.StatusCode);
            Assert.Equal("contributionNotTied", await Code(third));

            await Ok(await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Winner", new { candidateId = candidates[1] }));
            Assert.Equal(candidates[1], (await Phase(id)).GetProperty("winnerCandidateId").GetGuid());
        }

        [Fact]
        public async Task NoVotesLetsTheAdminPickAnyCandidate()
        {
            var (id, candidates) = await ClosedVote(0, 0, 0);

            var phase = await Phase(id);
            Assert.Equal(JsonValueKind.Null, phase.GetProperty("winnerCandidateId").ValueKind);
            Assert.False(phase.GetProperty("tie").GetBoolean());

            await Ok(await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Winner", new { candidateId = candidates[2] }));
            Assert.Equal(candidates[2], (await Phase(id)).GetProperty("winnerCandidateId").GetGuid());
        }

        [Fact]
        public async Task StoredWinnerNeverChanges()
        {
            var (id, candidates) = await ClosedVote(3, 1, 0);

            var response = await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Winner", new { candidateId = candidates[1] });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionWinnerSet", await Code(response));
        }

        [Fact]
        public async Task PhotoPhaseNeedsClosedVoteWithWinner()
        {
            var (open, _) = await CreateVote();
            await Ok(await Enable(open));
            var fromOpen = await Admin().PostAsJsonAsync("api/Admin/Contribution/Phases", new { kind = "photo", sourcePhaseId = open });
            Assert.Equal(HttpStatusCode.BadRequest, fromOpen.StatusCode);
            Assert.Equal("contributionSourceNoWinner", await Code(fromOpen));

            Clock.Advance(TimeSpan.FromDays(8));
            await Settings(); // closes "open" with no votes: no winner
            var fromNoWinner = await Admin().PostAsJsonAsync("api/Admin/Contribution/Phases", new { kind = "photo", sourcePhaseId = open });
            Assert.Equal("contributionSourceNoWinner", await Code(fromNoWinner));
        }

        [Fact]
        public async Task PhotoPhaseShowsItsSubject()
        {
            var (vote, candidates) = await ClosedVote(1, 4, 0);

            var photo = await CreatePhoto(vote);

            var phase = await Phase(photo);
            Assert.Equal("photo", phase.GetProperty("kind").GetString());
            Assert.Equal(candidates[1], phase.GetProperty("subject").GetProperty("id").GetGuid());
            Assert.Equal("Stamps", phase.GetProperty("subject").GetProperty("name").GetString());
            Assert.EndsWith(photo.ToString(), phase.GetProperty("folder").GetString());
        }

        [Fact]
        public async Task UsedByPhotoPhasesIsCounted()
        {
            var (vote, _) = await ClosedVote(3, 1, 0);

            await CreatePhoto(vote);
            await CreatePhoto(vote);

            Assert.Equal(2, (await Phase(vote)).GetProperty("usedByPhotoPhases").GetInt32());
        }

        [Fact]
        public async Task InterruptActivePhaseNeedsReason()
        {
            var (id, _) = await CreateVote();
            await Ok(await Enable(id));

            var noReason = await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Interrupt", new { reason = (string?)null });
            Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);
            Assert.Equal("contributionReasonRequired", await Code(noReason));

            await Ok(await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Interrupt", new { reason = "communityTooSmall" }));

            var phase = await Phase(id);
            Assert.Equal("interrupted", phase.GetProperty("state").GetString());
            Assert.Equal(JsonValueKind.Null, phase.GetProperty("winnerCandidateId").ValueKind);
            var settings = await Settings();
            Assert.False(settings.GetProperty("enabled").GetBoolean());
            Assert.Equal("communityTooSmall", settings.GetProperty("reason").GetString());
        }

        [Fact]
        public async Task CloseNowDecidesTheWinnerAndSwitchesOff()
        {
            var (id, candidates) = await CreateVote();
            await Ok(await Enable(id));
            AddVotes(id, candidates[2], 2);

            await Ok(await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Close", new { reason = (string?)null }));

            var phase = await Phase(id);
            Assert.Equal("closed", phase.GetProperty("state").GetString());
            Assert.Equal(candidates[2], phase.GetProperty("winnerCandidateId").GetGuid());
            Assert.Equal("justFinished", (await Settings()).GetProperty("reason").GetString());
        }

        [Fact]
        public async Task OnlyDraftsCanBeDeleted()
        {
            var (draft, _) = await CreateVote();
            var (open, _) = await CreateVote();
            await Ok(await Enable(open));

            Assert.Equal(HttpStatusCode.NoContent, (await Admin().DeleteAsync($"api/Admin/Contribution/Phases/{draft}")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await Admin().GetAsync($"api/Admin/Contribution/Phases/{draft}")).StatusCode);
            var refused = await Admin().DeleteAsync($"api/Admin/Contribution/Phases/{open}");
            Assert.Equal(HttpStatusCode.BadRequest, refused.StatusCode);
            Assert.Equal("contributionNotDraft", await Code(refused));
        }

        [Fact]
        public async Task TextsArePagedNewestFirstWithoutNames()
        {
            var (id, candidates) = await ClosedVote(2, 1, 0);

            var page = await Ok(await Admin().GetAsync($"api/Admin/Contribution/Phases/{id}/Texts?candidateId={candidates[0]}"));

            var items = page.GetProperty("items").EnumerateArray().ToList();
            Assert.Equal(2, items.Count);
            Assert.All(items, t => Assert.Equal(candidates[0], t.GetProperty("candidateId").GetGuid()));
            Assert.All(items, t => Assert.False(t.TryGetProperty("userId", out _)));
        }

        [Fact]
        public async Task SettleTwiceIsIdempotent()
        {
            var (first, _) = await CreateVote(TimeSpan.FromHours(1));
            await Ok(await Enable(first));
            Clock.Advance(TimeSpan.FromHours(2));
            using (var scope = Api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<IContributionLifecycle>().SettleAsync();
            var closedAt = (await Phase(first)).GetProperty("closedAt").GetDateTime();
            var (second, _) = await CreateVote();
            await Ok(await Enable(second));

            using (var scope = Api.Services.CreateScope())
                await scope.ServiceProvider.GetRequiredService<IContributionLifecycle>().SettleAsync();

            Assert.Equal(closedAt, (await Phase(first)).GetProperty("closedAt").GetDateTime());
            var settings = await Settings();
            Assert.True(settings.GetProperty("enabled").GetBoolean()); // the earlier close does not switch off the new round
            Assert.Equal(second, settings.GetProperty("activePhaseId").GetGuid());
        }

        [Fact]
        public async Task AdminRoutesRefuseAppTokens()
        {
            var (id, _) = await CreateVote();
            var app = UserClient(NewUser());

            foreach (var response in new[]
                     {
                         await app.GetAsync("api/Admin/Contribution/Settings"),
                         await app.GetAsync("api/Admin/Contribution/Phases"),
                         await app.GetAsync($"api/Admin/Contribution/Phases/{id}"),
                         await app.PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Close", new { }),
                     })
                Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden, response.StatusCode.ToString());
        }

        [Fact]
        public async Task ChangesAreAudited()
        {
            var (id, _) = await CreateVote();
            await Ok(await Enable(id));
            await Ok(await Admin().PostAsJsonAsync($"api/Admin/Contribution/Phases/{id}/Close", new { }));

            var actions = Db.NewContext().AdminAuditLog.Where(a => a.TargetType == "contribution").Select(a => a.Action).ToList();
            Assert.Contains("contribution.create", actions);
            Assert.Contains("contribution.settings", actions);
            Assert.Contains("contribution.close", actions);
        }

        [Fact]
        public async Task PhaseListFiltersByKindAndState()
        {
            var (vote, _) = await ClosedVote(1, 0, 0);
            await CreatePhoto(vote);

            var photos = await Ok(await Admin().GetAsync("api/Admin/Contribution/Phases?kind=photo"));
            Assert.All(photos.EnumerateArray(), p => Assert.Equal("photo", p.GetProperty("kind").GetString()));
            var closed = await Ok(await Admin().GetAsync("api/Admin/Contribution/Phases?state=closed"));
            Assert.Contains(closed.EnumerateArray(), p => p.GetProperty("id").GetGuid() == vote);
        }
    }
}
