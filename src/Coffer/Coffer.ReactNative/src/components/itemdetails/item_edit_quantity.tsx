import { customTheme } from "@/src/theme/theme";
import { useEffect, useState } from "react";
import { View } from "react-native";
import CustomIconButton from "../custom_ui/custom_icon_button";
import CustomText from "../custom_ui/custom_text";

interface ItemEditQuantityProps {
  defaultValue: number;
  onValueChange: (newValue: number) => void;
}

function ItemEditQuantity({
  defaultValue,
  onValueChange,
}: ItemEditQuantityProps) {
  const [quantity, setQuantity] = useState(defaultValue);

  useEffect(() => {
    setQuantity(defaultValue);
  }, [defaultValue]);

  const handleMinusPress = () => {
    onValueChange(quantity - 1);
    setQuantity((prev) => prev - 1);
  };

  const handlePlusPress = () => {
    onValueChange(quantity + 1);
    setQuantity((prev) => prev + 1);
  };

  return (
    <>
      <CustomText style={{ fontFamily: "VendSansBold", marginTop: 20 }}>
        Quantity
      </CustomText>
      <View
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexDirection: "row",
        }}
      >
        <CustomIconButton
          iconType="antdesign"
          iconName="minus"
          title="Decrease"
          onPress={handleMinusPress}
          disabled={quantity === 1}
        />
        <View
          style={{
            flexShrink: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "center",
            marginHorizontal: 10,
          }}
        >
          <CustomText
            style={{
              fontFamily: "VendSansBold",
              fontSize: 20,
              flexShrink: 1,
            }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {quantity}
          </CustomText>
          <CustomText style={{ color: customTheme.colors.secondary }}>
            {" "}
            pcs
          </CustomText>
        </View>
        <CustomIconButton
          iconType="antdesign"
          iconName="plus"
          title="Increase"
          onPress={handlePlusPress}
        />
      </View>
    </>
  );
}

export default ItemEditQuantity;
