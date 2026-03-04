import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useResetNavigation } from "@/src/hooks/navigation";
import React from "react";

interface CollectionDeleteFormProps {
  isDeleteCollectionConfirmVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function CollectionDeleteForm({
  isDeleteCollectionConfirmVisible,
}: CollectionDeleteFormProps) {
  const resetNavigate = useResetNavigation();
  const { collection } = useCollectionStore();

  const { mutateAsync: deleteCollection, isPending: isDeletePending } =
    useDeleteData(endpoints.collections);

  const handleOverlayClose = () => {
    if (isDeletePending) return;

    isDeleteCollectionConfirmVisible.set(false);
  };

  const handleDelete = async () => {
    try {
      await deleteCollection(collection.id);
      handleOverlayClose();
      resetNavigate({
        pathname: ROUTES.COLLECTIONS.ROOT,
        params: pageParams.collections,
      });
    } catch (error) {
      handleOverlayClose();
      console.error("Failed to delete collection:", error);
    }
  };

  return (
    <CustomOverlay
      isVisible={isDeleteCollectionConfirmVisible.value}
      onClose={handleOverlayClose}
      overlayTitle={"Delete Collection"}
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
        Are you sure you want to delete{" "}
        <CustomText style={{ fontSize: 20, fontFamily: "VendSansBold" }}>
          {collection.name}
        </CustomText>{" "}
        collection?
      </CustomText>
    </CustomOverlay>
  );
}

export default CollectionDeleteForm;
