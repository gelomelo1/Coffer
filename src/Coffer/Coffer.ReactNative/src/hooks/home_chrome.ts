import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

/**
 * Hide progress of the Home tab's chrome: 0 = header, search bar, tab bar and "+" fully shown; 1 = all hidden.
 * One value drives every transform, so the parts always move in step. Scroll handlers write it with setValue
 * (no React re-render); short snaps animate it on the JS driver (see settleHomeChrome).
 */
export const homeChromeProgress = new Animated.Value(0);

let current = 0;
let reduceMotion = false;
homeChromeProgress.addListener(({ value }) => {
  current = value;
});
AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion = v));
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => (reduceMotion = v));

/** Follow the finger: set progress directly (0–1). */
export function setHomeChromeProgress(progress: number) {
  homeChromeProgress.stopAnimation();
  homeChromeProgress.setValue(progress);
}

/** Settle at 0 (shown) or 1 (hidden): animated, or instant when the user asked for reduced motion. */
export function settleHomeChrome(target: 0 | 1) {
  if (current === target) return;
  if (reduceMotion) {
    setHomeChromeProgress(target);
    return;
  }
  Animated.timing(homeChromeProgress, {
    toValue: target,
    duration: 200,
    easing: Easing.out(Easing.cubic),
    // JS driver on purpose: scroll tracking writes this value from JS, and the tab bar's style is re-attached on
    // every tab switch; a native-owned value stops updating views attached after it went native.
    useNativeDriver: false,
  }).start();
}

/** Bring the chrome back (tab switch, sheet opened, top of the feed). */
export function showHomeChrome() {
  settleHomeChrome(0);
}

/** With a screen reader on, the chrome stays visible: hidden navigation can't be found by swiping. */
export function useHomeChromeLocked() {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setLocked);
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setLocked);
    return () => sub.remove();
  }, []);
  return locked;
}

/** True while the chrome is mostly hidden, so hidden controls can drop out of touch and accessibility. */
export function useHomeChromeHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const id = homeChromeProgress.addListener(({ value }) => setHidden(value > 0.5));
    return () => homeChromeProgress.removeListener(id);
  }, []);
  return hidden;
}
