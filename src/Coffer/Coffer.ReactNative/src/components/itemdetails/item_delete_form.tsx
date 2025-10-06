import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useItemStore } from "@/src/hooks/item_store";
import { useResetNavigation } from "@/src/hooks/navigation";
import { customTheme } from "@/src/theme/theme";
import React from "react";
import { View } from "react-native";
import { Overlay } from "react-native-elements";

interface ItemDeleteFormProps {
  isDeleteItemConfirmVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function ItemDeleteForm({ isDeleteItemConfirmVisible }: ItemDeleteFormProps) {
  const resetNavigate = useResetNavigation();
  const { item } = useItemStore();

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
        pathname: ROUTES.COLLECTIONS.MYCOLLECTION,
        params: pageParams.mycollection,
      });
    } catch (error) {
      handleOverlayClose();
      console.error("Failed to delete item:", error);
    }
  };

  return (
    <Overlay
      isVisible={isDeleteItemConfirmVisible.value}
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
          Are you sure you want to delete this item type?
          <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 14 }}>
            This not equal with removing a piece from the item type
          </CustomText>
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

export default ItemDeleteForm;
