import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import {
  Collection,
  CollectionRequired,
} from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { useState } from "react";
import { View } from "react-native";
import { Overlay } from "react-native-elements";
import CustomButton from "../custom_ui/custom_button";
import CustomDropdown from "../custom_ui/custom_dropdown";
import CustomTextInput from "../custom_ui/custom_text_input";

interface CreateCollectionFormProps {
  isCreateNewCollectionOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  collectionTypes: CollectionType[];
  user: User | undefined;
}

function CreateCollectionForm({
  isCreateNewCollectionOverlayOpen,
  collectionTypes,
  user,
}: CreateCollectionFormProps) {
  const [open, setOpen] = useState(false);

  const [collectionName, setCollectionName] = useState("");

  const [selectedCollectionTypeId, setSelectedCollectionTypeId] = useState<
    string | null
  >(null);

  const dropdownItems = collectionTypes.map((type) => ({
    label: type.name, // what you want to show
    value: type.id, // unique primitive value
  }));

  const { mutateAsync, isPending } = useCreateData<
    CollectionRequired,
    Collection
  >(endpoints.collections, querykeys.collectionsData);

  const resetFormData = () => {
    setOpen(false);
    setCollectionName("");
    setSelectedCollectionTypeId(null);
  };

  const handleOverlayClose = () => {
    if (isPending) return;
    isCreateNewCollectionOverlayOpen.set(false);
    resetFormData();
  };

  const submitCollectionCreation = async () => {
    if (user?.id && selectedCollectionTypeId && collectionName) {
      await mutateAsync({
        userId: user.id,
        collectionTypeId: selectedCollectionTypeId,
        name: collectionName,
      });
      handleOverlayClose();
    }
  };

  return (
    <Overlay
      isVisible={isCreateNewCollectionOverlayOpen.value}
      onBackdropPress={() => handleOverlayClose()}
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
      }}
    >
      <View
        style={{
          width: "90%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
        }}
      >
        <CustomDropdown
          open={open}
          value={selectedCollectionTypeId}
          items={dropdownItems}
          setOpen={setOpen}
          setValue={setSelectedCollectionTypeId}
          label="Collection type"
        />
        <CustomTextInput
          placeholder="Enter a name for your collection"
          label="Collection name"
          value={collectionName}
          onChangeText={(newValue) => setCollectionName(newValue)}
        />
        <CustomButton
          title="Create collection"
          disabled={selectedCollectionTypeId === null || collectionName === ""}
          containerStyle={{ marginTop: 20 }}
          loading={isPending}
          onPress={submitCollectionCreation}
        />
      </View>
    </Overlay>
  );
}

export default CreateCollectionForm;
