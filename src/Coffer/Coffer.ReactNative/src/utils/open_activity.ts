import { openItem } from "@/src/components/comments/open_item";
import { openListing } from "@/src/components/market/browse/listing_card";
import { openChat } from "@/src/components/market/chats/open_chat";
import showToast from "@/src/components/custom_ui/toast";
import { backendAxios } from "@/src/const/backendAccessConfiguration";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { useUserStore } from "@/src/hooks/user_store";
import { ActivityEntry } from "@/src/types/entities/activity";
import { Collection } from "@/src/types/entities/collection";
import User from "@/src/types/entities/user";
import { apiErrorMessage } from "@/src/utils/market_api";
import { navigate } from "expo-router/build/global-state/routing";

/** My own collection opens its editor; someone else's (a followed one) opens their collection page. */
export async function openCollection(collectionId: string) {
  try {
    const collection = (await backendAxios.get<Collection>(`${endpoints.collections}/${collectionId}`)).data;
    const type = useCollectionTypeStore.getState().collectionTypes.find((t) => t.id === collection.collectionTypeId);
    if (!type) throw new Error("unknown collection type");
    useCollectionStore.getState().setCollectionType(type);

    if (collection.userId === useUserStore.getState().user?.id) {
      useCollectionStore.getState().setCollection(collection);
      navigate({ pathname: ROUTES.MYCOLLECTION, params: pageParams.mycollection });
      return;
    }
    const owner = (await backendAxios.get<User>(`${endpoints.users}/${collection.userId}`)).data;
    useOtherUserStore.getState().setValues(owner, collection, null);
    navigate({ pathname: ROUTES.OTHERUSERCOLLECTION, params: pageParams.otherusercollection(owner.name, collection.name) });
  } catch (error) {
    showToast("error", apiErrorMessage(error, "activity:openFailed"));
  }
}

/** Opens where an activity entry happened. Gone targets are not opened (their rows are not pressable). */
export function openActivity(entry: ActivityEntry) {
  const t = entry.target;
  if (!t.available) return;
  switch (t.type) {
    case "comment":
      return openItem(t.itemId!, { commentId: t.commentId });
    case "item":
      return openItem(t.itemId!);
    case "collection":
      return openCollection(t.collectionId!);
    case "listing":
      return openListing(t.listingId!, t.title);
    case "conversation":
    case "deal":
    case "review":
      // A review lives in its deal's chat.
      if (t.conversationId) openChat(t.conversationId, t.otherName ?? "", t.title);
      return;
    case "report":
      navigate({ pathname: ROUTES.SETTINGS.REPORTS, params: pageParams.reports });
      return;
    case "contribution":
      navigate({ pathname: ROUTES.COMMUNITY.SHAPE, params: pageParams.communityPage("community:tiles.shape.title") });
      return;
  }
}
