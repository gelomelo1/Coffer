import { RefObject, useCallback, useEffect, useState } from "react";
import { Keyboard, KeyboardEvent, Platform, View } from "react-native";
import { computeToolbarBottom } from "../utils/keyboard_toolbar";

/**
 * Where (bottom offset inside `hostRef`) a toolbar must be placed so it sits directly on top of the keyboard.
 * Measures the real keyboard frame and the host's window position — no hard-coded offsets — and re-measures when
 * the host is laid out again (e.g. a KeyboardAvoidingView shrinking it after the keyboard event).
 * Returns `bottom: null` while the keyboard is hidden.
 */
export function useKeyboardToolbarOffset(hostRef: RefObject<View | null>) {
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [hostBottom, setHostBottom] = useState(0);

  const measure = useCallback(() => {
    hostRef.current?.measureInWindow((_x, y, _w, h) => setHostBottom(y + h));
  }, [hostRef]);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setKeyboardTop(e.endCoordinates.screenY);
      measure();
    };
    const onHide = () => setKeyboardTop(null);

    // iOS announces the final frame before animating; Android only after the keyboard is up.
    const subs =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillShow", onShow),
            Keyboard.addListener("keyboardWillChangeFrame", onShow),
            Keyboard.addListener("keyboardWillHide", onHide),
          ]
        : [Keyboard.addListener("keyboardDidShow", onShow), Keyboard.addListener("keyboardDidHide", onHide)];
    return () => subs.forEach((s) => s.remove());
  }, [measure]);

  return { bottom: computeToolbarBottom({ hostBottom, keyboardTop }), onHostLayout: measure };
}
