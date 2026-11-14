import { endpoints } from "@/src/const/endpoints";
import { useCollectionTypeStore } from "@/src/hooks/collection_type_store";
import { useUserStore } from "@/src/hooks/user_store";
import CustomDropdownItem from "@/src/types/helpers/custom_dropdown_item";
import { Image } from "react-native";

/** Item-type dropdown entries with the type's icon, the same way the collection screens show them. */
export function useCollectionTypeDropdownItems(): CustomDropdownItem<number>[] {
  const { collectionTypes } = useCollectionTypeStore();
  const { token } = useUserStore();

  return collectionTypes.map((type) => ({
    label: type.name,
    value: type.id,
    additionalElement: (
      <Image
        source={{
          uri: `${endpoints.icons}/${type.icon}`,
          headers: { Authorization: `Bearer ${token}` },
          cache: "reload",
        }}
        style={{ width: 28, height: 28 }}
      />
    ),
  }));
}
