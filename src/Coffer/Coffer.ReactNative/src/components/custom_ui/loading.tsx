import { customTheme } from "@/src/theme/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
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
      setDotCount((prev) => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View
      style={{
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

export function ComponentLoading() {
  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        backgroundColor: `${customTheme.colors.primary}CC`,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <ActivityIndicator size={"large"} color={customTheme.colors.secondary} />
    </View>
  );
}
