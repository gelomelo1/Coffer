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
