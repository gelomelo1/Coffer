import Attribute from "@/src/types/entities/attribute";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors } from "@/src/theme/theme";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip, ChipRow } from "../custom_ui/chip";

interface ItemEditDynamicBooleanProps {
  attribute: Attribute;
  defaultValue: boolean;
  onValueChange: (newValue: string | number | boolean) => void;
}

/** Yes/no attribute as a square toggle chip. */
function ItemEditDynamicBoolean({ attribute, defaultValue, onValueChange }: ItemEditDynamicBooleanProps) {
  const { t } = useTranslation();
  const [isOn, setIsOn] = useState(false);

  useEffect(() => {
    setIsOn(!!defaultValue);
  }, [defaultValue]);

  return (
    <ChipRow>
      <Chip
        label={t("collections:filter.isTrue", { name: attribute.name })}
        selected={isOn}
        icon={<MaterialIcons name={isOn ? "check-box" : "check-box-outline-blank"} size={18} color={colors.text} />}
        onPress={() => {
          const next = !isOn;
          setIsOn(next);
          onValueChange(next);
        }}
      />
    </ChipRow>
  );
}

export default ItemEditDynamicBoolean;
