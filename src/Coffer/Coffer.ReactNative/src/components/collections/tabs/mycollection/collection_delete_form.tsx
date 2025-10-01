import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useResetNavigation } from "@/src/hooks/navigation";
import { customTheme } from "@/src/theme/theme";
import React from "react";
import { View } from "react-native";
import { Overlay } from "react-native-elements";

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
    <Overlay
      isVisible={isDeleteCollectionConfirmVisible.value}
      onBackdropPress={handleOverlayClose}
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
      }}
    >
      <View
        style={{
          width: "90%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
        }}
      >
        <CustomText>
          Are you sure you want to delete{" "}
          <CustomText style={{ fontFamily: "VendSansBold" }}>
            {collection.name}
          </CustomText>{" "}
          collection?
        </CustomText>
        <CustomButton
          title={"Delete"}
          loading={isDeletePending}
          onPress={handleDelete}
        />
      </View>
    </Overlay>
  );
}

export default CollectionDeleteForm;
