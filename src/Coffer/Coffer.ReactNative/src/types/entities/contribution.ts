/** Shape What's Next (contribution): what api/Contribution answers. */

export type ContributionReason = "justFinished" | "communityTooSmall" | "contributionFinished" | "modelsInProgress";

export type CandidateView = { id: string; name: string; description: string };

export type MyVote = { candidateId: string; text: string };

export type Mine = { detectionPhotos: number; classificationForms: number };

export type Limits = { perUpload: number; formMin: number; formMax: number; dailyLeft: number; dailyResetsAt: string };

/** The running phase: a vote (candidates, my vote) or a photo round (subject, my counts, limits). */
export type PhaseView = {
  id: string;
  kind: "vote" | "photo";
  openedAt: string;
  endsAt: string;
  candidates: CandidateView[] | null;
  myVote: MyVote | null;
  subject: CandidateView | null;
  mine: Mine | null;
  limits: Limits | null;
};

export type ResultRow = { candidateId: string; name: string; votes: number; share: number };

export type LatestResult = { phaseId: string; winnerCandidateId: string; rows: ResultRow[] };

export type ContributionState = {
  serverNow: string;
  enabled: boolean;
  reason: ContributionReason | null;
  phase: PhaseView | null;
  latestResult: LatestResult | null;
};

export type VoteInput = { phaseId: string; candidateId: string; text: string };

export type ContributionForm = "detection" | "classification";

export type ContributionExamples = Record<ContributionForm, string[]>;
