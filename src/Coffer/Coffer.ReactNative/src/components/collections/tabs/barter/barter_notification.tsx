import CustomText from "@/src/components/custom_ui/custom_text";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View } from "react-native";

interface BarterNotificationProps {
  title: string;
}

function BarterNotification({ title }: BarterNotificationProps) {
  return (
    <View
      style={{
        width: "100%",
        justifyContent: "flex-start",
        alignItems: "center",
        flexDirection: "row",
      }}
    >
      <MaterialIcons name="report-gmailerrorred" size={24} color="red" />
      <CustomText style={{ color: "red" }}>{title}</CustomText>
    </View>
  );
}

export default BarterNotification;
