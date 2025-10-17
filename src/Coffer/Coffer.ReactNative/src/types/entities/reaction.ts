interface Reaction {
  id: string;
  userId: string;
  itemId: string;
  liked: boolean;
  rarity: number;
}

export default Reaction;
