import { borders, colors } from "@/src/theme/theme";
import { Image, View } from "react-native";

/** 48dp square thumbnail used by search result rows. */
export function ResultThumb({ uri, token, background }: { uri: string; token?: string | null; background?: string }) {
  return (
    <View style={{ width: 48, height: 48, borderWidth: borders.width, borderColor: colors.border, backgroundColor: background ?? colors.surfaceAlt, overflow: "hidden" }}>
      <Image source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "reload" }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    </View>
  );
}
