import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { ReactNode } from "react";
import { Text, View } from "react-native";

interface ItemDetailsAttributeContainerProps {
  title: string;
  children: ReactNode;
}

/** One attribute row: label above value, hairline under it. */
function ItemDetailsAttributeContainer({ title, children }: ItemDetailsAttributeContainerProps) {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 2, borderBottomWidth: borders.hairline, borderBottomColor: colors.borderMuted }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

export default ItemDetailsAttributeContainer;
