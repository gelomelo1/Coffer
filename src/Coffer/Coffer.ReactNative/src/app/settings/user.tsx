import { Screen } from "@/src/components/custom_ui/screen";
import UserInfoCard from "@/src/components/settings/user_info_card";
import { useUserStore } from "@/src/hooks/user_store";

/** Own profile: general info (editable) and the marketplace reputation. */
function User() {
  const { user, setUser } = useUserStore();
  return (
    <Screen scroll>
      <UserInfoCard user={user} setUser={setUser} />
    </Screen>
  );
}

export default User;
