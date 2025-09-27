import { customTheme } from "@/src/theme/theme";
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { LinearProgress } from "react-native-elements";

interface LoadingProps {
  label?: string;
}

export function LoadingScreen({ label }: LoadingProps) {
  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: customTheme.colors.background,
        gap: 50,
        padding: 50,
      }}
    >
      <Image
        source={require("../../../assets/images/iconwithlabel.png")}
        style={{ width: "60%", height: "auto", aspectRatio: "1/1" }}
      />
      <View style={{ width: "100%" }}>
        {label ? (
          <Text style={{ color: customTheme.colors.primary }}>{label}</Text>
        ) : null}
        <LinearProgress
          value={0}
          variant="indeterminate"
          color={customTheme.colors.secondary}
          trackColor={customTheme.colors.primary}
        />
      </View>
    </View>
  );
}

export const Loading = () => {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4); // cycles 0 → 1 → 2 → 3
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontFamily: "VendSansBold",
          color: customTheme.colors.primary,
        }}
      >
        Loading
        <Text style={{ color: customTheme.colors.secondary }}>
          {".".repeat(dotCount)}
        </Text>
      </Text>
    </View>
  );
};
