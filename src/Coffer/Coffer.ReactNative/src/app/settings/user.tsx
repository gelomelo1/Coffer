import CustomText from "@/src/components/custom_ui/custom_text";
import AddContactOverlay from "@/src/components/settings/user_settings/add_contact_overlay";
import ContactCard from "@/src/components/settings/user_settings/contact_card";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import AntDesign from "@expo/vector-icons/AntDesign";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";

function User() {
  const [isAddContactOverlayVisible, setIsAddContactOverlayVisible] =
    useState(false);

  const { user, setUser } = useUserStore();

  return (
    <>
      <View
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          backgroundColor: customTheme.colors.background,
          padding: 10,
        }}
      >
        <View
          style={{
            width: "100%",
            justifyContent: "space-between",
            flexDirection: "row",
          }}
        >
          <CustomText style={{ fontFamily: "VendSansBold", fontSize: 18 }}>
            Contact info
            <CustomText>{" (for barter)"}</CustomText>
          </CustomText>
          <TouchableOpacity onPress={() => setIsAddContactOverlayVisible(true)}>
            <AntDesign
              name="plus"
              size={24}
              color={customTheme.colors.primary}
            />
          </TouchableOpacity>
        </View>
        {user!.contacts.length === 0 ? (
          <CustomText style={{ fontFamily: "VendSansItalic" }}>
            No contact info added yet
          </CustomText>
        ) : null}
        {user!.contacts.map((contact) => (
          <ContactCard
            key={contact.id}
            user={user!}
            setUser={setUser}
            contact={contact}
            isSettings={true}
          />
        ))}
      </View>
      <AddContactOverlay
        isAddContactOverlayVisible={{
          value: isAddContactOverlayVisible,
          set: setIsAddContactOverlayVisible,
        }}
      />
    </>
  );
}

export default User;
