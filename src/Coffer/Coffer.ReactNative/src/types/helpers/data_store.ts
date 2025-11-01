import { NavigationModeInfo } from "react-native-navigation-mode";
import { Collection } from "../entities/collection";
import CollectionType from "../entities/collectiontype";
import { ItemProvided } from "../entities/item";
import { Offer } from "../entities/offer";
import { Trade } from "../entities/trade";
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

export interface OtherUserStore {
  user: User | null;
  collection: Collection | null;
  item: ItemProvided | null;
  setValues: (
    user?: User | null,
    collection?: Collection | null,
    item?: ItemProvided | null
  ) => void;
  setUser: (user: User | null) => void;
  setCollection: (collection: Collection | null) => void;
  setItem: (item: ItemProvided | null) => void;
}

export interface TradeStore {
  trade: Trade | null;
  setTrade: (trade: Trade | null) => void;
}

export interface OfferStore {
  offer: Offer | null;
  setOffer: (offer: Offer | null) => void;
}
