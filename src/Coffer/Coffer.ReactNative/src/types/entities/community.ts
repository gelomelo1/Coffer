/** GET api/Community/Stats: the community in numbers (shared part cached 5 minutes on the server). */
export interface CommunityStats {
  generatedAt: string;
  totals: { members: number; items: number; pieces: number; collections: number; interactions: number };
  interactions: { thisWeek: number; thisMonth: number };
  /** Visible items first added, and visible collections created, this week / this month. */
  newItems: { thisWeek: number; thisMonth: number };
  newCollections: { thisWeek: number; thisMonth: number };
  /** 12 weeks, oldest first; each point is the total at that week's end (the current week: so far). */
  growth: { weekStart: string; members: number; items: number; collections: number }[];
  topCollector: { userId: string; name: string; avatar: string | null; activityCount: number } | null;
  trendingType: { id: number; name: string; color: string; icon: string; itemsAdded: number } | null;
  milestones: Milestone[];
}

/** A weekly goal on a ladder of targets: met → next week one rung up, missed → one rung down. */
export interface Milestone {
  key: "itemsAdded" | "activeUsers";
  target: number;
  progress: number;
  streak: number;
  bestTarget: number;
  /** 0-based rung of this week's target, out of `rungs`. */
  rung: number;
  rungs: number;
  /** The viewer's part this week. */
  mine: { count: number; active: boolean };
}
