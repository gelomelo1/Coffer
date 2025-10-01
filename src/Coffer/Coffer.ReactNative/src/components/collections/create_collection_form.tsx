import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData, useGetData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import {
  Collection,
  CollectionRequired,
} from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { Filter } from "profanity-check";
import React, { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Icon, Overlay } from "react-native-elements";
import CustomButton from "../custom_ui/custom_button";
import CustomDropdown from "../custom_ui/custom_dropdown";
import CustomTextInput from "../custom_ui/custom_text_input";

interface CreateCollectionFormProps {
  isCreateNewCollectionOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  collectionTypes: CollectionType[];
  user: User;
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
  const [errorMessage, setErrorMessage] = useState("");
  const [isInputCheck, setIsInputCheck] = useState(true);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageFilter = new Filter();

  const dropdownItems = collectionTypes.map((type) => ({
    label: type.name,
    value: type.id,
  }));

  const isSubmitDisabled =
    collectionName === "" || selectedCollectionTypeId === null || isInputCheck;

  const { isFetching, refetch } = useGetData<Collection>(
    endpoints.collections,
    querykeys.collectionsWithCurrentName,
    {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user.id,
        },
        {
          filter: "Match",
          field: "name",
          value: collectionName,
        },
      ],
    },
    undefined,
    {
      enabled: false,
      queryKey: [querykeys.collectionsWithCurrentName],
    }
  );

  const { mutateAsync, isPending } = useCreateData<
    CollectionRequired,
    Collection
  >(endpoints.collections, querykeys.collectionsData);

  const resetFormData = () => {
    setOpen(false);
    setCollectionName("");
    setSelectedCollectionTypeId(null);
    setErrorMessage("");
    setIsInputCheck(true);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
  };

  const handleOverlayClose = () => {
    if (isPending) return;
    isCreateNewCollectionOverlayOpen.set(false);
    resetFormData();
  };

  const handleChangeCollectionName = (newValue: string) => {
    setCollectionName(newValue);
    setIsInputCheck(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (newValue === "") {
      setErrorMessage("");
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      const usernameRegex = /^[a-zA-Z0-9._-]+$/;

      if (!usernameRegex.test(newValue)) {
        setErrorMessage("Allowed characters: letters, numbers, ., _, -");
        return;
      }

      if (languageFilter.isProfane(newValue)) {
        setErrorMessage("Please avoid using inappropriate language");
        return;
      }

      const collectionsWithCurrentName = (await refetch()).data ?? [];

      if (collectionsWithCurrentName?.length !== 0) {
        setErrorMessage("You already have a collection with this name");
        return;
      }

      setErrorMessage("");
      setIsInputCheck(false);
    }, 1000);
  };

  const handleSubmitCollectionCreation = async () => {
    if (user?.id && selectedCollectionTypeId && collectionName) {
      await mutateAsync({
        value: {
          userId: user.id,
          collectionTypeId: selectedCollectionTypeId,
          name: collectionName,
        },
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
          onChangeText={(newValue) => handleChangeCollectionName(newValue)}
          errorMessage={errorMessage}
          rightIcon={
            isFetching ? (
              <ActivityIndicator size="small" color="dimgray" />
            ) : !!errorMessage ? (
              <Icon name="close" size={20} color="red" />
            ) : !isInputCheck ? (
              <Icon name="check" size={20} color="green" />
            ) : undefined
          }
        />
        <CustomButton
          title="Create collection"
          disabled={isSubmitDisabled}
          containerStyle={{ marginTop: 20 }}
          loading={isPending}
          onPress={handleSubmitCollectionCreation}
        />
      </View>
    </Overlay>
  );
}

export default CreateCollectionForm;
