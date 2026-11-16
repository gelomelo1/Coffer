import { Screen } from "@/src/components/custom_ui/screen";
import SettingsUserCard from "@/src/components/settings/settings_user_card";
import { useUserStore } from "@/src/hooks/user_store";

/** Own profile: general info + marketplace contacts, both editable. */
function User() {
  const { user, setUser } = useUserStore();
  return (
    <Screen scroll>
      <SettingsUserCard user={user} setUser={setUser} />
    </Screen>
  );
}

export default User;
