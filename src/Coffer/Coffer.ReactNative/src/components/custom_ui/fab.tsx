import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Animated, Pressable, Text, View } from "react-native";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

const FAB_SIZE = 56;

/**
 * Square floating action button: navy tile, gold icon, hard shadow that sinks on press.
 * `translateY` / `opacity` animate it (hide-on-scroll chrome); `hidden` removes it from touch and screen readers
 * while it is faded out.
 */
export function RetroFab({
  icon,
  onPress,
  label,
  bottom,
  right = spacing.md,
  translateY,
  opacity,
  hidden = false,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  bottom: number;
  right?: number;
  translateY?: Animated.AnimatedInterpolation<number> | Animated.Value;
  opacity?: Animated.AnimatedInterpolation<number> | Animated.Value;
  hidden?: boolean;
}) {
  return (
    <Animated.View
      pointerEvents={hidden ? "none" : "box-none"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={{ position: "absolute", right, bottom, opacity: opacity ?? 1, transform: translateY ? [{ translateY }] : undefined }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          {
            width: FAB_SIZE,
            height: FAB_SIZE,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            borderWidth: borders.width,
            borderColor: colors.secondary,
          },
          pressableShadowStyle(pressed),
        ]}
      >
        <MaterialCommunityIcons name={icon} size={28} color={colors.secondary} />
      </Pressable>
    </Animated.View>
  );
}

export interface FabAction {
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** FAB that expands into labelled actions above it, over a dimmed scrim. */
export function RetroFabGroup({
  open,
  onToggle,
  actions,
  bottom,
  openLabel,
  closeLabel,
}: {
  open: boolean;
  onToggle: () => void;
  actions: FabAction[];
  bottom: number;
  openLabel: string;
  closeLabel: string;
}) {
  return (
    <>
      {open ? (
        <Pressable
          onPress={onToggle}
          accessible={false}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(254,253,240,0.85)" }}
        />
      ) : null}
      {open ? (
        <View style={{ position: "absolute", right: spacing.md, bottom: bottom + FAB_SIZE + spacing.md, gap: spacing.sm, alignItems: "flex-end" }}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => {
                onToggle();
                a.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  minHeight: 48,
                  paddingHorizontal: spacing.md,
                  backgroundColor: colors.bg,
                  borderWidth: borders.width,
                  borderColor: colors.primary,
                },
                pressableShadowStyle(pressed),
              ]}
            >
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{a.label}</Text>
              <MaterialCommunityIcons name={a.icon} size={24} color={colors.text} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <RetroFab icon={open ? "close" : "plus"} onPress={onToggle} label={open ? closeLabel : openLabel} bottom={bottom} />
    </>
  );
}
