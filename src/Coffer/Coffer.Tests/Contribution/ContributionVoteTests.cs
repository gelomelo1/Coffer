using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Coffer.Domain.Entities;

namespace Coffer.Tests.Contribution
{
    /// <summary>The app's Shape What's Next page: what it shows in each state, and voting.</summary>
    [Collection("api")]
    public class ContributionVoteTests : ContributionTestBase
    {
        private async Task<JsonElement> State(User user, string? language = null)
        {
            var client = UserClient(user);
            if (language != null) client.DefaultRequestHeaders.AcceptLanguage.ParseAdd(language);
            return await Ok(await client.GetAsync("api/Contribution"));
        }

        private Task<HttpResponseMessage> Vote(User user, Guid phaseId, Guid candidateId, string text = "Year, mint mark, metal and diameter.") =>
            UserClient(user).PutAsJsonAsync("api/Contribution/Vote", new { phaseId, candidateId, text });

        private async Task<(Guid Id, Guid[] Candidates)> OpenVote(TimeSpan? endsIn = null)
        {
            var vote = await CreateVote(endsIn);
            await Ok(await Enable(vote.Id));
            return vote;
        }

        [Fact]
        public async Task DisabledShowsReasonAndNoPhase()
        {
            var state = await State(NewUser());

            Assert.False(state.GetProperty("enabled").GetBoolean());
            Assert.Equal("communityTooSmall", state.GetProperty("reason").GetString());
            Assert.Equal(JsonValueKind.Null, state.GetProperty("phase").ValueKind);
            Assert.Equal(Clock.UtcNow, state.GetProperty("serverNow").GetDateTime(), TimeSpan.FromSeconds(1));
        }

        [Fact]
        public async Task PausedPhaseIsHidden()
        {
            await OpenVote();
            await Ok(await Disable("modelsInProgress"));

            var state = await State(NewUser());

            Assert.Equal(JsonValueKind.Null, state.GetProperty("phase").ValueKind);
            Assert.Equal("modelsInProgress", state.GetProperty("reason").GetString());
        }

        [Fact]
        public async Task OpenVotePhaseShowsCandidatesNotCounts()
        {
            var (id, candidates) = await OpenVote();
            AddVotes(id, candidates[0], 3);

            var phase = (await State(NewUser())).GetProperty("phase");

            Assert.Equal("vote", phase.GetProperty("kind").GetString());
            var shown = phase.GetProperty("candidates").EnumerateArray().ToList();
            Assert.Equal(candidates, shown.Select(c => c.GetProperty("id").GetGuid()).ToArray());
            Assert.All(shown, c => Assert.False(c.TryGetProperty("votes", out _)));
            Assert.All(shown, c => Assert.False(c.TryGetProperty("share", out _)));
            Assert.Equal(JsonValueKind.Null, phase.GetProperty("myVote").ValueKind);
        }

        [Fact]
        public async Task CandidateNamesFollowTheRequestLanguage()
        {
            await OpenVote();

            var shown = (await State(NewUser(), "hu")).GetProperty("phase").GetProperty("candidates");

            Assert.Equal("Bélyeg", shown[1].GetProperty("name").GetString());
            Assert.Equal("Pins", shown[2].GetProperty("name").GetString()); // no translation → English
        }

        [Fact]
        public async Task VoteIsStoredAndCanBeChanged()
        {
            var (id, candidates) = await OpenVote();
            var voter = NewUser();

            await Ok(await Vote(voter, id, candidates[0], "Year and mint mark, they matter."));
            var changed = await Ok(await Vote(voter, id, candidates[1], "Perforation and country, please."));

            Assert.Equal(candidates[1], changed.GetProperty("candidateId").GetGuid());
            var votes = Db.NewContext().ContributionVotes.Where(v => v.PhaseId == id).ToList();
            Assert.Single(votes);
            Assert.Equal("Perforation and country, please.", votes[0].Text);
            var myVote = (await State(voter)).GetProperty("phase").GetProperty("myVote");
            Assert.Equal(candidates[1], myVote.GetProperty("candidateId").GetGuid());
        }

        [Theory]
        [InlineData(9)]
        [InlineData(1001)]
        public async Task VoteTextLengthIsChecked(int length)
        {
            var (id, candidates) = await OpenVote();

            var response = await Vote(NewUser(), id, candidates[0], new string('a', length));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionVoteText", await Code(response));
        }

        [Fact]
        public async Task VoteForAnotherPhasesCandidateIsRefused()
        {
            var (id, _) = await OpenVote();
            var (_, otherCandidates) = await CreateVote();

            var response = await Vote(NewUser(), id, otherCandidates[0]);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("contributionUnknownCandidate", await Code(response));
        }

        [Fact]
        public async Task VoteAtEndTimeIsRefused()
        {
            var (id, candidates) = await OpenVote(TimeSpan.FromHours(1));
            Clock.Advance(TimeSpan.FromHours(1));

            var response = await Vote(NewUser(), id, candidates[0]);

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("contributionClosed", await Code(response));
            Assert.Empty(Db.NewContext().ContributionVotes.Where(v => v.PhaseId == id));
        }

        [Fact]
        public async Task VoteWhilePausedIsRefused()
        {
            var (id, candidates) = await OpenVote();
            await Ok(await Disable("modelsInProgress"));

            var response = await Vote(NewUser(), id, candidates[0]);

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal("contributionClosed", await Code(response));
        }

        [Fact]
        public async Task VoteRecordsActivity()
        {
            var (id, candidates) = await OpenVote();
            var voter = NewUser();

            await Ok(await Vote(voter, id, candidates[0]));
            await Ok(await Vote(voter, id, candidates[1]));

            var events = Db.NewContext().ActivityEvents.Where(e => e.UserId == voter.Id).OrderBy(e => e.OccurredAt).ThenBy(e => e.Kind == "contribution.voteChanged").ToList();
            Assert.Equal(new[] { "contribution.voted", "contribution.voteChanged" }, events.Select(e => e.Kind));
            Assert.All(events, e => Assert.Equal("contribution", e.Category));
            var changed = JsonDocument.Parse(events[1].Details).RootElement;
            Assert.Equal("Stamps", changed.GetProperty("candidate").GetString());
            Assert.Equal("Coins", changed.GetProperty("previousCandidate").GetString());
            Assert.Equal(id, changed.GetProperty("phaseId").GetGuid());
        }

        [Fact]
        public async Task LatestResultShowsWinnerAndShares()
        {
            var (id, candidates) = await ClosedVote(3, 1, 0);

            var latest = (await State(NewUser())).GetProperty("latestResult");

            Assert.Equal(id, latest.GetProperty("phaseId").GetGuid());
            Assert.Equal(candidates[0], latest.GetProperty("winnerCandidateId").GetGuid());
            var rows = latest.GetProperty("rows").EnumerateArray().ToList();
            Assert.Equal(new[] { 3, 1, 0 }, rows.Select(r => r.GetProperty("votes").GetInt32()));
            Assert.Equal(1.0, rows.Sum(r => r.GetProperty("share").GetDouble()), 3);
        }

        [Fact]
        public async Task PhotoPhaseShowsSubjectCountsAndLimits()
        {
            var (vote, _) = await ClosedVote(1, 4, 0);
            var photo = await CreatePhoto(vote);
            await Ok(await Enable(photo));

            var phase = (await State(NewUser(), "hu")).GetProperty("phase");

            Assert.Equal("photo", phase.GetProperty("kind").GetString());
            Assert.Equal("Bélyeg", phase.GetProperty("subject").GetProperty("name").GetString());
            Assert.Equal(0, phase.GetProperty("mine").GetProperty("detectionPhotos").GetInt32());
            Assert.Equal(0, phase.GetProperty("mine").GetProperty("classificationForms").GetInt32());
            var limits = phase.GetProperty("limits");
            Assert.Equal(20, limits.GetProperty("perUpload").GetInt32());
            Assert.Equal(5, limits.GetProperty("formMin").GetInt32());
            Assert.Equal(10, limits.GetProperty("formMax").GetInt32());
            Assert.Equal(300, limits.GetProperty("dailyLeft").GetInt32());
        }
    }
}
