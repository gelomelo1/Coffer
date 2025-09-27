import CustomButton from "@/src/components/custom_ui/custom_button";
import { customTheme } from "@/src/theme/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View } from "react-native";

function Developer() {
  const handleClearStorage = async () => {
    await AsyncStorage.clear();
    alert("Async Storage Cleared");
  };

  return (
    <View
      style={{
        flex: 1,
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        backgroundColor: customTheme.colors.background,
      }}
    >
      <CustomButton
        title={"Delete Async Storage"}
        onPress={handleClearStorage}
      />
    </View>
  );
}

export default Developer;
