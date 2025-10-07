import { customTheme } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import CustomText from "../custom_ui/custom_text";

interface ItemEditDynamicBooleanProps {
  attribute: Attribute;
  defaultValue: boolean;
  onValueChange: (newValue: string | number | boolean) => void;
}

function ItemEditDynamicBoolean({
  attribute,
  defaultValue,
  onValueChange,
}: ItemEditDynamicBooleanProps) {
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    if (defaultValue) setIsOn(defaultValue);
    else setIsOn(false);
  }, [defaultValue]);

  return (
    <View style={{ justifyContent: "flex-end", flexDirection: "row" }}>
      <CustomText>{`Is ${attribute.name}`}</CustomText>
      <Switch
        value={isOn}
        onValueChange={(newValue) => {
          setIsOn(newValue);
          onValueChange(newValue);
        }}
        trackColor={{ true: customTheme.colors.secondary }}
        thumbColor={customTheme.colors.primary}
      />
    </View>
  );
}

export default ItemEditDynamicBoolean;
