import { NavigationModeInfo } from "react-native-navigation-mode";
import { Collection } from "../entities/collection";
import CollectionType from "../entities/collectiontype";
import User from "../entities/user";

export interface NavigationModeStore {
  navigationMode: NavigationModeInfo;
}

export interface CollectionStore {
  collectionType: CollectionType;
  collection: Collection;
  setCollection: (collection: Collection) => void;
}

export interface UserStore {
  user: User;
}
