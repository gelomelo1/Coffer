import { borders, colors } from "@/src/theme/theme";
import Feather from "@expo/vector-icons/Feather";
import { Image, View } from "react-native";

/** Square retro avatar: photo, or a user glyph on gold. Decorative unless a label is given. */
export function Avatar({ uri, size = 40, accessibilityLabel }: { uri?: string | null; size?: number; accessibilityLabel?: string }) {
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderWidth: borders.width,
        borderColor: colors.border,
        backgroundColor: colors.secondary,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
      ) : (
        <Feather name="user" size={Math.round(size * 0.55)} color={colors.primary} />
      )}
    </View>
  );
}

export default Avatar;
