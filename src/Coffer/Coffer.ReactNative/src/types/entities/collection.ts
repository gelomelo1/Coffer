export interface CollectionRequired {
  userId: string;
  collectionTypeId: string;
  name: string;
}

export interface Collection extends CollectionRequired {
  id: string;
  image: string;
  createdAt: string;
}
