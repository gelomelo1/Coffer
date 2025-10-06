import { useItemStore } from "@/src/hooks/item_store";
import { customTheme } from "@/src/theme/theme";
import { Overlay } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";

interface ItemEditFormProps {
  isItemEditFormOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function ItemEditForm({ isItemEditFormOverlayOpen }: ItemEditFormProps) {
  const handleOverlayClose = () => {
    isItemEditFormOverlayOpen.set(false);
  };

  const { item } = useItemStore();

  return (
    <Overlay
      isVisible={isItemEditFormOverlayOpen.value}
      onBackdropPress={handleOverlayClose}
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
      }}
    >
      <CustomText>{item.id}</CustomText>
    </Overlay>
  );
}

export default ItemEditForm;
