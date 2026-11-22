import IndexCustomLayout from "@/src/components/layout/index_custom_layout";
import { useUserStore } from "@/src/hooks/user_store";
import { Stack } from "expo-router";

/** The Community tab's pages (News, Stats & facts, Shape What's Next). */
function CommunityLayout() {
  const { user } = useUserStore();

  return <Stack screenOptions={({ route }) => IndexCustomLayout(user, route)} />;
}

export default CommunityLayout;
