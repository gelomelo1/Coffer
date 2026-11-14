import showToast from "@/src/components/custom_ui/toast";
import { backendAxios } from "@/src/const/backendAccessConfiguration";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { Collection } from "@/src/types/entities/collection";
import { ItemProvided } from "@/src/types/entities/item";
import User from "@/src/types/entities/user";
import { apiErrorMessage } from "@/src/utils/market_api";
import { navigate } from "expo-router/build/global-state/routing";

/**
 * Opens a collection item (with its comments) from anywhere, e.g. from Settings › Reports. Loads the item, its
 * collection and owner, then shows the read-only item page — the same one the feed opens.
 */
export async function openItem(itemId: string) {
  try {
    const item = (await backendAxios.get<ItemProvided>(`${endpoints.items}/${itemId}`)).data;
    const collection = (await backendAxios.get<Collection>(`${endpoints.collections}/${item.collectionId}`)).data;
    const owner = (await backendAxios.get<User>(`${endpoints.users}/${collection.userId}`)).data;
    const type = useCollectionTypeStore.getState().collectionTypes.find((t) => t.id === collection.collectionTypeId);
    if (!type) throw new Error("unknown collection type");

    useCollectionStore.getState().setCollectionType(type);
    useOtherUserStore.getState().setValues(owner, collection, item);
    navigate({ pathname: ROUTES.OTHERUSERITEMDETAILS, params: pageParams.otheruseritemdetails(collection.name) });
  } catch (error) {
    showToast("error", apiErrorMessage(error, "This item no longer exists."));
  }
}
