import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useItemStore } from "@/src/hooks/item_store";
import { useResetNavigation } from "@/src/hooks/navigation";
import React from "react";
import CustomOverlay from "../custom_ui/custom_overlay";

interface ItemDeleteFormProps {
  isDeleteItemConfirmVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function ItemDeleteForm({ isDeleteItemConfirmVisible }: ItemDeleteFormProps) {
  const resetNavigate = useResetNavigation();
  const { item } = useItemStore();
  const { collectionType } = useCollectionStore();

  const { mutateAsync: deleteCollection, isPending: isDeletePending } =
    useDeleteData(endpoints.items);

  const handleOverlayClose = () => {
    if (isDeletePending) return;

    isDeleteItemConfirmVisible.set(false);
  };

  const handleDelete = async () => {
    try {
      await deleteCollection(item.id);
      handleOverlayClose();
      resetNavigate({
        pathname: ROUTES.MYCOLLECTION,
        params: pageParams.mycollection,
      });
    } catch (error) {
      handleOverlayClose();
      console.error("Failed to delete item:", error);
    }
  };

  return (
    <CustomOverlay
      isVisible={isDeleteItemConfirmVisible.value}
      onClose={handleOverlayClose}
      overlayTitle="Delete Item"
      footerContent={
        <CustomButton
          title="Delete"
          containerStyle={{ width: "90%", alignSelf: "center" }}
          loading={isDeletePending}
          onPress={handleDelete}
        />
      }
    >
      <CustomText
        style={{
          marginHorizontal: 10,
          marginVertical: 10,
          textAlign: "center",
          fontSize: 20,
        }}
      >
        Are you sure you want to delete this{" "}
        {collectionType!.name.toLowerCase()} from your collection?
      </CustomText>
    </CustomOverlay>
  );
}

export default ItemDeleteForm;
