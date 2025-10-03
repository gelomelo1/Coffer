import CustomText from "@/src/components/custom_ui/custom_text";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { customTheme } from "@/src/theme/theme";
import { View } from "react-native";

function CollectionItemTitle() {
  const { collectionType, collection } = useCollectionStore();
  return (
    <CustomText style={{ marginTop: 20, marginBottom: 5, fontSize: 20 }}>
      Your{" "}
      <View style={{ transform: [{ translateY: 5 }] }}>
        <CustomText
          style={{
            fontSize: 24,
            fontFamily: "VendSansBold",
            color: customTheme.colors.secondary,
          }}
        >
          {collectionType.name}
        </CustomText>
      </View>{" "}
      collection
    </CustomText>
  );
}

export default CollectionItemTitle;
