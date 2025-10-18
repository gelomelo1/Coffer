export interface FollowRequired {
  userId: string;
  collectionId: string;
}

export interface Follow extends FollowRequired {
  id: string;
  followedAt: string;
}
