import { ViewStyle } from "react-native";
import { shadow } from "./theme";

/**
 * Retro press feedback: the element carries a hard offset shadow and "sinks" into it while pressed.
 * Disabled elements have no shadow (they are not pressable).
 */
export function pressableShadowStyle(pressed: boolean, disabled = false): ViewStyle {
  if (disabled) return { boxShadow: "none", transform: [{ translateX: 0 }, { translateY: 0 }] };
  if (pressed)
    return {
      boxShadow: "none",
      transform: [{ translateX: shadow.offset }, { translateY: shadow.offset }],
    };
  return { boxShadow: shadow.pressable, transform: [{ translateX: 0 }, { translateY: 0 }] };
}
