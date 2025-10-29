import AntDesign from "@expo/vector-icons/AntDesign";
import { TouchableOpacity, View } from "react-native";
import { Divider } from "react-native-elements";
import { customTheme } from "../../theme/theme";
import CustomText from "../custom_ui/custom_text";

interface SettingsButtonProps {
  title: string;
  icon: React.ReactElement;
  onPress: () => void;
  isLastInList?: boolean;
}

function SettingsButton({
  title,
  icon,
  onPress,
  isLastInList = false,
}: SettingsButtonProps) {
  return (
    <View style={{ width: "95%", marginBottom: 5 }}>
      <TouchableOpacity onPress={() => onPress()}>
        <View
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
            marginBottom: 5,
          }}
        >
          <View
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              flexDirection: "row",
              gap: 20,
              marginLeft: 10,
            }}
          >
            {icon}
            <CustomText style={{ fontSize: 20 }}>{title}</CustomText>
          </View>
          <AntDesign
            name="right"
            size={20}
            color={customTheme.colors.primary}
            style={{ marginRight: 10 }}
          />
        </View>
      </TouchableOpacity>
      {!isLastInList ? <Divider color={customTheme.colors.secondary} /> : null}
    </View>
  );
}

export default SettingsButton;
