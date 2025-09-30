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
    <TouchableOpacity style={{ width: "95%" }} onPress={() => onPress()}>
      <View
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexDirection: "row",
          marginBottom: 15,
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
      {!isLastInList ? <Divider color={customTheme.colors.secondary} /> : null}
    </TouchableOpacity>
  );
}

export default SettingsButton;
