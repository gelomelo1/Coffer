import CustomText from "@/src/components/custom_ui/custom_text";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useOtherUserStore } from "@/src/hooks/other_user_store";
import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { getCountryByCode } from "@/src/utils/data_access_utils";
import { navigate } from "expo-router/build/global-state/routing";
import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Avatar } from "react-native-elements";

interface FeedSearchUserCardProps {
  user: User;
}

function FeedSearchUserCard({ user }: FeedSearchUserCardProps) {
  const { setUser } = useOtherUserStore();

  const [country, setCountry] = useState<string | null>(null);

  useEffect(() => {
    const getCountry = async () => {
      const countryByCode = await getCountryByCode(user.country);
      setCountry(countryByCode?.name?.toString() ?? null); // <-- fallback to null
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
    <TouchableOpacity
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
      }}
      onPress={handleNavigation}
    >
      <Avatar
        size={48}
        rounded
        source={user?.avatar ? { uri: user.avatar } : undefined}
        icon={
          !user?.avatar
            ? {
                name: "user",
                type: "feather",
                color: customTheme.colors.secondary,
              }
            : undefined
        }
        containerStyle={{ backgroundColor: customTheme.colors.primary }}
      />
      <View>
        <CustomText style={{ fontFamily: "VendSansBold" }}>
          {user.name}
        </CustomText>
        <CustomText style={{ fontSize: 14 }}>{country ?? ""}</CustomText>
      </View>
    </TouchableOpacity>
  );
}

export default FeedSearchUserCard;
