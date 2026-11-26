namespace Coffer.BusinessLogic.Contribution
{
    // ------------------------------------------------------------------ Manager

    public sealed record AdminSettingsDto(bool Enabled, string? Reason, Guid? ActivePhaseId);

    public sealed record SettingsInput(bool Enabled, string? Reason, Guid? ActivePhaseId);

    public sealed record CandidateInput(string? Name, Dictionary<string, string>? NameTranslations, string? Description,
        Dictionary<string, string>? DescriptionTranslations);

    /// <summary>Create: kind and its parts. Update: a draft takes everything (kind ignored); an open phase only <c>EndsAt</c>.</summary>
    public sealed record PhaseInput(string? Kind, DateTime? EndsAt, List<CandidateInput>? Candidates, Guid? SourcePhaseId);

    public sealed record AdminCandidateDto(Guid Id, int Position, string Name, Dictionary<string, string> NameTranslations, string Description,
        Dictionary<string, string> DescriptionTranslations, int Votes, double Share);

    public sealed record PhotoTotalsDto(int DetectionPhotos, int Forms, int FormPhotos, int Contributors);

    /// <summary>
    /// A phase as the Manager shows it. Vote: candidates with counts, winner, tie, how many photo phases use it.
    /// Photo: the subject (its voting phase's winner), totals, storage folder.
    /// </summary>
    public sealed record AdminPhaseDto(Guid Id, string Kind, string State, bool Active, DateTime? OpenedAt, DateTime? EndsAt, DateTime? ClosedAt,
        Guid? SourcePhaseId, Guid? WinnerCandidateId, bool Tie, int UsedByPhotoPhases, List<AdminCandidateDto> Candidates,
        AdminCandidateDto? Subject, PhotoTotalsDto? Totals, string? Folder, DateTime CreatedAt);

    /// <summary>A voter's free text, without who wrote it.</summary>
    public sealed record VoteTextDto(Guid CandidateId, string Text, DateTime UpdatedAt);

    public sealed record CloseInput(string? Reason);

    public sealed record WinnerInput(Guid CandidateId);
}

namespace Coffer.BusinessLogic.Contribution
{
    using System.Text.Json.Serialization;
    using Coffer.Domain.Localization;

    // ------------------------------------------------------------------ app

    /// <summary>A candidate (or a photo phase's subject) in the request's language, English as fallback.</summary>
    public sealed class CandidateViewDto
    {
        public Guid Id { get; init; }
        [TranslatedBy(nameof(NameTranslations))] public string Name { get; init; } = "";
        [TranslatedBy(nameof(DescriptionTranslations))] public string Description { get; init; } = "";
        [JsonIgnore] public Dictionary<string, string> NameTranslations { get; init; } = new();
        [JsonIgnore] public Dictionary<string, string> DescriptionTranslations { get; init; } = new();
    }

    public sealed record MyVoteDto(Guid CandidateId, string Text);

    public sealed record MineDto(int DetectionPhotos, int ClassificationForms);

    public sealed record LimitsDto(int PerUpload, int FormMin, int FormMax, int DailyLeft, DateTime DailyResetsAt);

    /// <summary>
    /// The running phase. Vote: candidates, the user's vote and the live standings (<c>Results</c>). Photo: subject, the
    /// user's counts, limits and what everyone sent so far (<c>Totals</c>).
    /// </summary>
    public sealed record PhaseViewDto(Guid Id, string Kind, DateTime OpenedAt, DateTime EndsAt, List<CandidateViewDto>? Candidates, MyVoteDto? MyVote,
        CandidateViewDto? Subject, MineDto? Mine, LimitsDto? Limits, List<ResultRowDto>? Results, PhotoTotalsDto? Totals);

    public sealed class ResultRowDto
    {
        public Guid CandidateId { get; init; }
        [TranslatedBy(nameof(NameTranslations))] public string Name { get; init; } = "";
        [JsonIgnore] public Dictionary<string, string> NameTranslations { get; init; } = new();
        public int Votes { get; init; }
        public double Share { get; init; }
    }

    /// <summary>The most recent closed voting phase with a winner, shown while no phase runs.</summary>
    public sealed record LatestResultDto(Guid PhaseId, Guid WinnerCandidateId, List<ResultRowDto> Rows);

    /// <summary>
    /// What the Shape What's Next page shows. <c>Phase</c> is null while the switch is off (or its phase is paused);
    /// <c>ServerNow</c> lets the phone's countdown ignore a wrong phone clock.
    /// </summary>
    public sealed record ContributionStateDto(DateTime ServerNow, bool Enabled, string? Reason, PhaseViewDto? Phase, LatestResultDto? LatestResult);

    public sealed record VoteInput(Guid PhaseId, Guid CandidateId, string? Text);
}
