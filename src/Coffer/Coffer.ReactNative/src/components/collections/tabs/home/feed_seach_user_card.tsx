import Avatar from "@/src/components/custom_ui/avatar";
import ListRow from "@/src/components/custom_ui/list_row";
import { countryFlag } from "@/src/utils/market_api";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import User from "@/src/types/entities/user";
import { getCountryByCode } from "@/src/utils/data_access_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";

interface FeedSearchUserCardProps {
  user: User;
}

function FeedSearchUserCard({ user }: FeedSearchUserCardProps) {
  const { setUser } = useOtherUserStore();

  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    const getCountry = async () => {
      const countryByCode = await getCountryByCode(user.country);
      setCountry(countryByCode?.name?.toString() ?? null);
    };

    getCountry();
  }, [user]);

  const handleNavigation = () => {
    setUser(user);
    navigate({
      pathname: ROUTES.OTHERUSER,
      params: pageParams.otheruser(user.name),
    });
  };

  return (
    <ListRow
      title={user.name}
      subtitle={[countryFlag(user.country), country].filter(Boolean).join(" ") /* i18n-ignore */}
      leading={<Avatar uri={user.avatar} size={48} />}
      onPress={handleNavigation}
    />
  );
}

export default FeedSearchUserCard;
