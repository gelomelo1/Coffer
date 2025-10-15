import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { getCountryByCode } from "@/src/utils/data_access_utils";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Country } from "react-native-country-picker-modal";
import { Avatar } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";

export interface SettingsUserCardProps {
  user: User | null;
}

function SettingsUserCard({ user }: SettingsUserCardProps) {
  const providerIcon =
    user?.provider === "google"
      ? require("../../../assets/images/googlesignin.png")
      : require("../../../assets/images/githubsignin.png");

  const [country, setCountry] = useState<Country | null>(null);

  useEffect(() => {
    const fetchCountry = async () => {
      if (user?.country) {
        const countryData = await getCountryByCode(user.country);
        setCountry(countryData);
      }
    };

    fetchCountry();
  }, [user?.country]);

  return (
    <View
      style={{
        width: "90%",
        alignSelf: "center",
        alignItems: "center",
        backgroundColor: customTheme.colors.secondary,
        borderRadius: 50,
        paddingHorizontal: 10,
        paddingVertical: 20,
        marginBottom: 40,
      }}
    >
      <Avatar
        size={80}
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
      <CustomText style={{ fontFamily: "VendSansBold", fontSize: 24 }}>
        {user?.name}
      </CustomText>

      {/* Row with equal sections and divider */}
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {/* Provider section */}
        <View style={{ flex: 1, alignItems: "center" }}>
          <CustomText style={{ fontFamily: "VendSansItalic", fontSize: 14 }}>
            Logged in with
          </CustomText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              justifyContent: "center",
            }}
          >
            <Image source={providerIcon} style={{ width: 16, height: 16 }} />
            <CustomText style={{ fontSize: 18 }}>{user?.provider}</CustomText>
          </View>
        </View>

        {/* Vertical divider */}
        <View
          style={{
            width: 1,
            height: 40,
            backgroundColor: customTheme.colors.primary,
          }}
        />

        {/* Country section */}
        <View style={{ flex: 1, alignItems: "center" }}>
          {country?.flag && (
            <Image
              source={{ uri: country.flag }}
              style={{ width: 16, height: 16 }}
            />
          )}
          <CustomText style={{ fontSize: 18 }}>
            {country?.name.toString()}
          </CustomText>
        </View>
      </View>
    </View>
  );
}

export default SettingsUserCard;
