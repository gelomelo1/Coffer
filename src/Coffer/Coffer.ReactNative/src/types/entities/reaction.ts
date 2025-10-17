export interface ReactionRequired {
  userId: string;
  itemId: string;
  liked: boolean;
  rarity: number | null;
}

export interface Reaction extends ReactionRequired {
  id: string;
}
