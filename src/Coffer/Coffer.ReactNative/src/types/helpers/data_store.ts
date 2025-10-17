import { NavigationModeInfo } from "react-native-navigation-mode";
import { Collection } from "../entities/collection";
import CollectionType from "../entities/collectiontype";
import { ItemProvided } from "../entities/item";
import User from "../entities/user";

export interface ItemStore {
  item: ItemProvided;
  setItem: (item: ItemProvided) => void;
}

export interface NavigationModeStore {
  navigationMode: NavigationModeInfo;
}

export interface CollectionStore {
  collectionType: CollectionType;
  collection: Collection;
  setCollection: (collection: Collection) => void;
}

export interface UserStore {
  user: User | null;
  setUser: (user: User | null) => void;
}
