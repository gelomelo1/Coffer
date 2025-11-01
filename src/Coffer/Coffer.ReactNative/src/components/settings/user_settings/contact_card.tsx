import { endpoints } from "@/src/const/endpoints";
import { useDeleteData } from "@/src/hooks/data_hooks";
import User from "@/src/types/entities/user";
import { UserContact } from "@/src/types/entities/user_contact";
import AntDesign from "@expo/vector-icons/AntDesign";
import {
  ActivityIndicator,
  Image,
  Linking,
  TouchableOpacity,
  View,
} from "react-native";
import CustomText from "../../custom_ui/custom_text";

interface ContactCardProps {
  user: User;
  setUser?: (user: User | null) => void;
  contact: UserContact;
  isSettings: boolean;
}

function ContactCard({ user, setUser, contact, isSettings }: ContactCardProps) {
  const { mutateAsync: deleteContact, isPending } = useDeleteData(
    endpoints.userContact
  );

  const handleDeleteContact = async () => {
    try {
      await deleteContact(contact.id);
      setUser!({
        ...user,
        contacts: user.contacts.filter((c) => c.id !== contact.id),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleContactPress = (contact: UserContact) => {
    switch (contact.platform) {
      case "Phone":
        Linking.openURL(`tel:${contact.value}`);
        break;
      case "Facebook":
        if (contact.link) Linking.openURL(contact.link);
        break;
      case "Instagram":
        if (contact.link) Linking.openURL(contact.link);
        break;
      default:
        break;
    }
  };

  return (
    <View
      style={{
        width: "100%",
        justifyContent: "space-between",
        flexDirection: "row",
        padding: 10,
      }}
    >
      <TouchableOpacity
        onPress={() => handleContactPress(contact)}
        style={{
          justifyContent: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        {contact.platform === "Phone" && (
          <>
            <AntDesign name="phone" size={24} color="green" />
            <CustomText style={{ fontSize: 18 }}>{contact.value}</CustomText>
          </>
        )}
        {contact.platform === "Facebook" && (
          <>
            <Image
              source={require("../../../../assets/images/facebook_icon.png")}
              style={{ width: 24, height: 24 }}
            />
            <CustomText style={{ fontSize: 18 }}>{contact.value}</CustomText>
          </>
        )}
        {contact.platform === "Instagram" && (
          <>
            <Image
              source={require("../../../../assets/images/instagram_icon.png")}
              style={{ width: 24, height: 24 }}
            />
            <CustomText style={{ fontSize: 18 }}>{contact.value}</CustomText>
          </>
        )}
      </TouchableOpacity>
      {isSettings ? (
        isPending ? (
          <ActivityIndicator size="small" color="dimgray" />
        ) : (
          <TouchableOpacity onPress={handleDeleteContact}>
            <AntDesign name="close" size={24} color="red" />
          </TouchableOpacity>
        )
      ) : null}
    </View>
  );
}

export default ContactCard;
