using Coffer.BusinessLogic.Activity;
using Coffer.BusinessLogic.Contribution;
using Coffer.BusinessLogic.Marketplace.Common;
using Coffer.Domain.Entities;
using Coffer.Tests.Images;
using Coffer.Tests.ItemTypes;
using Microsoft.AspNetCore.Http;

namespace Coffer.Tests.Contribution
{
    /// <summary>Requests that are in flight while a phase ends, and closes that race each other.</summary>
    public class ContributionRaceTests : IDisposable
    {
        private readonly TestDb _db = new();

        public ContributionRaceTests() => TestEnvironment.Ensure(); // COFFER_ROOT_PATH for the photo store

        /// <summary>Moves one step forward every time it is read: time passes while a request runs.</summary>
        private sealed class SteppingClock : IClock
        {
            private DateTime _now;
            private readonly TimeSpan _step;
            public SteppingClock(DateTime start, TimeSpan step) { _now = start; _step = step; }
            public DateTime UtcNow { get { var now = _now; _now += _step; return now; } }
        }

        private sealed class FixedClock : IClock
        {
            public DateTime UtcNow { get; set; }
        }

        private static readonly DateTime EndsAt = new(2026, 12, 1, 12, 0, 0, DateTimeKind.Utc);

        /// <summary>A running phase of the given kind (a photo phase gets a closed vote with a winner as its source).</summary>
        private ContributionPhase Running(ContributionPhaseKind kind)
        {
            Guid? source = null;
            if (kind == ContributionPhaseKind.Photo)
            {
                var vote = Phase(ContributionPhaseKind.Vote, ContributionPhaseState.Closed);
                vote.WinnerCandidateId = vote.Candidates[0].Id;
                source = vote.Id;
            }
            var phase = Phase(kind, ContributionPhaseState.Open);
            phase.SourcePhaseId = source;
            _db.Context.ContributionSettings.Add(new ContributionSettings { Id = 1, Enabled = true, ActivePhaseId = phase.Id, UpdatedAt = EndsAt.AddDays(-7) });
            _db.Context.SaveChanges();
            return phase;
        }

        private ContributionPhase Phase(ContributionPhaseKind kind, ContributionPhaseState state)
        {
            var id = Guid.NewGuid();
            var phase = new ContributionPhase
            {
                Id = id, Kind = kind, State = state, OpenedAt = EndsAt.AddDays(-7), EndsAt = EndsAt,
                CreatedAt = EndsAt.AddDays(-8), UpdatedAt = EndsAt.AddDays(-8),
                Candidates = kind == ContributionPhaseKind.Vote
                    ? new[] { "Coins", "Stamps", "Pins" }.Select((n, i) => new ContributionCandidate { Id = Guid.NewGuid(), PhaseId = id, Position = i + 1, Name = n }).ToList()
                    : new List<ContributionCandidate>(),
            };
            _db.Context.ContributionPhases.Add(phase);
            _db.Context.SaveChanges();
            return phase;
        }

        private ContributionService Service(IClock clock) =>
            new(_db.Context, clock, new ContributionLifecycle(_db.Context, clock), new ActivityLog(_db.Context, clock));

        [Fact]
        public async Task VoteThatReachesTheEndWhileInFlightIsRefused()
        {
            var phase = Running(ContributionPhaseKind.Vote);
            var user = _db.AddUser("voter");
            // Passes the running check a moment before the end; by the time it would be saved, the end has come.
            var clock = new SteppingClock(EndsAt.AddSeconds(-3), TimeSpan.FromSeconds(1));

            var error = await Assert.ThrowsAsync<MarketplaceException>(() =>
                Service(clock).VoteAsync(user.Id, new VoteInput(phase.Id, phase.Candidates[0].Id, "Year and mint mark, please.")));

            Assert.Equal("contributionClosed", error.Code);
            Assert.Empty(_db.NewContext().ContributionVotes);
            Assert.Empty(_db.NewContext().ActivityEvents);
        }

        [Fact]
        public async Task UploadThatReachesTheEndWhileInFlightIsRefused()
        {
            var phase = Running(ContributionPhaseKind.Photo);
            var user = _db.AddUser("uploader");
            var clock = new SteppingClock(EndsAt.AddSeconds(-3), TimeSpan.FromSeconds(1));
            var photos = Enumerable.Range(0, 2).Select(_ => UploadedImagesTests.FormFile(ItemTypeFilesTests.Jpeg(64, 48))).ToList();

            var error = await Assert.ThrowsAsync<MarketplaceException>(() => Service(clock).UploadDetectionAsync(user.Id, phase.Id, photos));

            Assert.Equal("contributionClosed", error.Code);
            Assert.Empty(_db.NewContext().ContributionUploads);
            Assert.False(Directory.Exists(ContributionStorage.DetectionDir(phase.Id)) && Directory.EnumerateFiles(ContributionStorage.DetectionDir(phase.Id)).Any());
        }

        [Fact]
        public async Task CloseAfterAnInterruptIsANoOp()
        {
            var phase = Running(ContributionPhaseKind.Vote);
            var clock = new FixedClock { UtcNow = EndsAt.AddMinutes(1) };
            // Another request interrupts the phase (with its own reason) while this one is about to close it by date.
            using (var other = _db.NewContext())
            {
                other.ContributionPhases.Single(p => p.Id == phase.Id).State = ContributionPhaseState.Interrupted;
                var settings = other.ContributionSettings.Single();
                settings.Enabled = false;
                settings.Reason = ContributionReasons.CommunityTooSmall;
                other.SaveChanges();
            }
            _db.Context.ContributionVotes.Add(new ContributionVote { PhaseId = phase.Id, UserId = _db.AddUser("v").Id, CandidateId = phase.Candidates[0].Id, Text = "0123456789" });
            _db.Context.SaveChanges();

            var closed = await new ContributionLifecycle(_db.Context, clock).TryCloseAsync(phase.Id, EndsAt, ContributionReasons.JustFinished, onlyIfDue: true);

            Assert.False(closed);
            using var fresh = _db.NewContext();
            var stored = fresh.ContributionPhases.Single(p => p.Id == phase.Id);
            Assert.Equal(ContributionPhaseState.Interrupted, stored.State);
            Assert.Null(stored.WinnerCandidateId);
            Assert.Equal(ContributionReasons.CommunityTooSmall, fresh.ContributionSettings.Single().Reason);
        }

        [Fact]
        public async Task SecondCloseIsANoOp()
        {
            var phase = Running(ContributionPhaseKind.Vote);
            var clock = new FixedClock { UtcNow = EndsAt.AddMinutes(-10) };
            var lifecycle = new ContributionLifecycle(_db.Context, clock);

            Assert.True(await lifecycle.TryCloseAsync(phase.Id, clock.UtcNow, ContributionReasons.JustFinished, onlyIfDue: false));
            Assert.False(await lifecycle.TryCloseAsync(phase.Id, clock.UtcNow.AddMinutes(1), ContributionReasons.ModelsInProgress, onlyIfDue: false));

            using var fresh = _db.NewContext();
            Assert.Equal(clock.UtcNow, DateTime.SpecifyKind(fresh.ContributionPhases.Single(p => p.Id == phase.Id).ClosedAt!.Value, DateTimeKind.Utc));
            Assert.Equal(ContributionReasons.JustFinished, fresh.ContributionSettings.Single().Reason);
        }

        public void Dispose() => _db.Dispose();
    }
}
