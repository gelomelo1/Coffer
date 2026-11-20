import { Stack } from "expo-router";

/** The review screen draws its own header (close, progress, help). */
function ReviewLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default ReviewLayout;
