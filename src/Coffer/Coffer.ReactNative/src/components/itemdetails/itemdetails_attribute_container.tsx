import { ReactNode } from "react";
import { View } from "react-native";
import CustomText from "../custom_ui/custom_text";

interface ItemDetailsAttributeContainerProps {
  collectionTypeColor: string;
  darkContrastColor: string;
  lightContrastColor: string;
  title: string;
  children: ReactNode;
}

function ItemDetailsAttributeContainer({
  collectionTypeColor,
  darkContrastColor,
  lightContrastColor,
  title,
  children,
}: ItemDetailsAttributeContainerProps) {
  return (
    <View
      style={{
        backgroundColor: collectionTypeColor,
        borderWidth: 2,
        borderColor: darkContrastColor,
        borderRadius: 20,
        padding: 10,
      }}
    >
      <CustomText style={{ color: lightContrastColor, fontSize: 18 }}>
        {title}
      </CustomText>
      {children}
    </View>
  );
}

export default ItemDetailsAttributeContainer;
