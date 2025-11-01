import CustomText from "@/src/components/custom_ui/custom_text";
import ContactCard from "@/src/components/settings/user_settings/contact_card";
import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { TouchableOpacity, View } from "react-native";
import { Avatar } from "react-native-elements";

interface TradeUserContactsProps {
  user: User;
  onUserPressed: () => void;
}

function TradeUserContacts({ user, onUserPressed }: TradeUserContactsProps) {
  return (
    <View style={{ width: "100%" }}>
      <CustomText style={{ fontFamily: "VendSansBold", fontSize: 18 }}>
        {"Trader's contact infos"}
      </CustomText>
      <View
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          flexDirection: "row",
          gap: 10,
        }}
      >
        <TouchableOpacity
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            flexDirection: "row",
            gap: 10,
          }}
          onPress={onUserPressed}
        >
          <Avatar
            size={32}
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
          <CustomText>{user.name}</CustomText>
        </TouchableOpacity>
      </View>
      <View style={{ width: "100%", marginLeft: 10 }}>
        {user.contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            user={user}
            setUser={undefined}
            contact={contact}
            isSettings={false}
          />
        ))}
      </View>
    </View>
  );
}

export default TradeUserContacts;
