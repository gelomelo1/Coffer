import CustomButton from "@/src/components/custom_ui/custom_button";
import { customTheme } from "@/src/theme/theme";
import FontAwesome from "@expo/vector-icons/FontAwesome";

function CollectionListFilterButton() {
  return (
    <CustomButton
      title="Filter"
      containerStyle={{
        position: "absolute",
        bottom: 10,
        left: 10,
        right: 10,
      }}
      titleStyle={{
        fontSize: 20,
      }}
      icon={
        <FontAwesome
          name="filter"
          size={24}
          color={customTheme.colors.secondary}
          style={{ marginRight: 5 }}
        />
      }
    />
  );
}

export default CollectionListFilterButton;
