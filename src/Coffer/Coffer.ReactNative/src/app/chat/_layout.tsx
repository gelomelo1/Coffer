import IndexCustomLayout from "@/src/components/layout/index_custom_layout";
import { useUserStore } from "@/src/hooks/user_store";
import { Stack } from "expo-router";

function ChatLayout() {
  const { user } = useUserStore();

  return (
    <Stack screenOptions={({ route }) => IndexCustomLayout(user, route)} />
  );
}

export default ChatLayout;
