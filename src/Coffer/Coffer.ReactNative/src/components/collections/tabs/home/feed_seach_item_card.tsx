import ListRow from "@/src/components/custom_ui/list_row";
import { ResultThumb } from "./result_thumb";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { initItemStore } from "@/src/hooks/item_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import ItemSearch from "@/src/types/entities/item_search";
import User from "@/src/types/entities/user";
import { getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { useTranslation } from "react-i18next";

interface FeedSearchItemCardProps {
  currentUser: User;
  itemSearch: ItemSearch;
  closeOverlay: () => void;
}

function FeedSearchItemCard({
  currentUser,
  itemSearch,
  closeOverlay,
}: FeedSearchItemCardProps) {
  const { t } = useTranslation();
  const { collectionTypes } = useCollectionTypeStore();
  const { token } = useUserStore();
  const { setValues } = useOtherUserStore();
  const { setCollectionType, setCollection } = useCollectionStore();

  const handleNavigation = () => {
    setCollectionType(
      collectionTypes.find(
        (ct) => ct.id === itemSearch.collection.collectionTypeId,
      )!,
    );
    if (currentUser.id === itemSearch.user.id) {
      setCollection(itemSearch.collection);
      initItemStore(itemSearch.item);
      navigate({
        pathname: ROUTES.ITEMDETAILS,
        params: pageParams.itemdetails,
      });
    } else {
      setValues(itemSearch.user, itemSearch.collection, itemSearch.item);
      navigate({
        pathname: ROUTES.OTHERUSERITEMDETAILS,
        params: pageParams.otheruseritemdetails(itemSearch.collection.name),
      });
    }
    closeOverlay();
  };

  const primaryAttribute = getItemPrimaryAttributeValue(
    itemSearch.item.itemAttributes,
  );

  return (
    <ListRow
      title={primaryAttribute?.valueString ?? ""}
      subtitle={t("feed:search.itemSubtitle", { user: itemSearch.user.name, collection: itemSearch.collection.name })}
      leading={<ResultThumb uri={`${endpoints.itemsCoverImage}/${itemSearch.item.image}`} token={token} />}
      onPress={handleNavigation}
    />
  );
}

export default FeedSearchItemCard;
