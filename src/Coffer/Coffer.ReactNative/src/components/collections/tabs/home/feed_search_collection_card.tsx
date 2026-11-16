import ListRow from "@/src/components/custom_ui/list_row";
import { ResultThumb } from "./result_thumb";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import CollectionSearch from "@/src/types/entities/collection_search";
import User from "@/src/types/entities/user";
import { navigate } from "expo-router/build/global-state/routing";
import { useTranslation } from "react-i18next";

interface FeedSearchCollectionCardProps {
  currentUser: User;
  collectionSearch: CollectionSearch;
  closeOverlay: () => void;
}

function FeedSearchCollectionCard({
  currentUser,
  collectionSearch,
  closeOverlay,
}: FeedSearchCollectionCardProps) {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const { token } = useUserStore();
  const { setUser, setCollection } = useOtherUserStore();
  const { setCollectionType, setCollection: setCurrentUserCollection } =
    useCollectionStore();

  const handleNavigation = () => {
    setCollectionType(
      collectionTypes.find(
        (ct) => ct.id === collectionSearch.collection.collectionTypeId,
      )!,
    );
    if (currentUser.id === collectionSearch.user.id) {
      setCurrentUserCollection(collectionSearch.collection);
      navigate({
        pathname: ROUTES.MYCOLLECTION,
        params: pageParams.mycollection,
      });
    } else {
      setUser(collectionSearch.user);
      setCollection(collectionSearch.collection);
      navigate({
        pathname: ROUTES.OTHERUSERCOLLECTION,
        params: pageParams.otherusercollection(
          collectionSearch.user.name,
          collectionSearch.collection.name,
        ),
      });
    }
    closeOverlay();
  };

  const collectionType = collectionTypes.find((ct) => ct.id === collectionSearch.collection.collectionTypeId);
  return (
    <ListRow
      title={collectionSearch.collection.name}
      subtitle={[collectionSearch.user.name, t("feed:search.followers", { count: collectionSearch.collection.follows.length })].join(" · ") /* i18n-ignore */}
      leading={
        <ResultThumb
          uri={
            collectionSearch.collection.image
              ? `${endpoints.collectionsCoverImage}/${collectionSearch.collection.image}`
              : `${endpoints.icons}/${collectionType?.icon}`
          }
          token={token}
          background={collectionType?.color}
        />
      }
      onPress={handleNavigation}
    />
  );
}

export default FeedSearchCollectionCard;
