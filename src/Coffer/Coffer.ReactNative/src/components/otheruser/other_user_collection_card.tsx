import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { Collection } from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { navigate } from "expo-router/build/global-state/routing";
import { CollectionTile } from "../collections/collections_container";

interface OtherUserCollectionCardProps {
  currentUser: User;
  user: User;
  collection: Collection;
  collectionType: CollectionType;
  columns: number;
}

/** Another user's collection tile (same look as the own collections grid); my own collections open my editor. */
function OtherUserCollectionCard({ currentUser, user, collection, collectionType, columns }: OtherUserCollectionCardProps) {
  const { token } = useUserStore();
  const { setCollectionType, setCollection: setCurrentUserCollection } = useCollectionStore();
  const { setCollection } = useOtherUserStore();

  const handleNavigation = () => {
    setCollectionType(collectionType);
    if (currentUser.id === user.id) {
      setCurrentUserCollection(collection);
      navigate({ pathname: ROUTES.MYCOLLECTION, params: pageParams.mycollection });
    } else {
      setCollection(collection);
      navigate({ pathname: ROUTES.OTHERUSERCOLLECTION, params: pageParams.otherusercollection(user.name, collection.name) });
    }
  };

  return <CollectionTile item={collection} type={collectionType} token={token} columns={columns} onPress={handleNavigation} />;
}

export default OtherUserCollectionCard;
