import { Follow } from "./follow";

export interface CollectionRequired {
  userId: string;
  collectionTypeId: number;
  name: string;
  description?: string;
}

export interface Collection extends CollectionRequired {
  id: string;
  image: string;
  createdAt: string;
  follows: Follow[];
}
