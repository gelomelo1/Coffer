import { colors, sizes } from "@/src/theme/theme";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleProp, TextStyle } from "react-native";

const families = {
  antdesign: AntDesign,
  entypo: Entypo,
  feather: Feather,
  fontawesome: FontAwesome,
  "font-awesome": FontAwesome,
  ionicon: Ionicons,
  ionicons: Ionicons,
  material: MaterialIcons,
  materialicons: MaterialIcons,
  "material-community": MaterialCommunityIcons,
  materialcommunityicons: MaterialCommunityIcons,
} as const;

export type IconFamily = keyof typeof families;

interface AppIconProps {
  name: string;
  family?: IconFamily | string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/** One entry point for every vector icon family the app uses (keys match the old react-native-elements `type`). */
function AppIcon({ name, family = "materialicons", size = sizes.iconMd, color = colors.text, style }: AppIconProps) {
  const Family = (families as Record<string, React.ComponentType<any>>)[family.toLowerCase()] ?? MaterialIcons;
  return <Family name={name} size={size} color={color} style={style} accessibilityElementsHidden importantForAccessibility="no" />;
}

export default AppIcon;
