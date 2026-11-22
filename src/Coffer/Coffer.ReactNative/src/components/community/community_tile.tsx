import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, Text, View } from "react-native";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

interface CommunityTileProps {
  icon: IconName;
  title: string;
  subtitle: string;
  /** Tile background; text and icon use `foreground` (pairs checked for contrast). */
  background: string;
  foreground: string;
  onPress: () => void;
}

/** One of the Community tab's three big tiles: they share the screen's height equally. */
export function CommunityTile({ icon, title, subtitle, background, foreground, onPress }: CommunityTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: 96,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          padding: spacing.lg,
          backgroundColor: background,
          borderWidth: borders.width,
          borderColor: colors.border,
        },
        pressableShadowStyle(pressed),
      ]}
    >
      <View
        style={{
          width: 64,
          height: 64,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: borders.width,
          borderColor: foreground,
        }}
      >
        <MaterialCommunityIcons name={icon} size={36} color={foreground} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text style={[typography.headline, { color: foreground }]}>{title}</Text>
        <Text style={[typography.body, { color: foreground }]}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={28} color={foreground} />
    </Pressable>
  );
}

export default CommunityTile;
