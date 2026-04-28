import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useCreateData, useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import {
  Collection,
  CollectionRequired,
} from "@/src/types/entities/collection";
import CollectionType from "@/src/types/entities/collectiontype";
import User from "@/src/types/entities/user";
import { Filter } from "profanity-check";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { Icon } from "react-native-elements";
import CustomButton from "../custom_ui/custom_button";
import CustomDropdown from "../custom_ui/custom_dropdown";
import CustomOverlay from "../custom_ui/custom_overlay";
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
  const { token } = useUserStore();
  const [open, setOpen] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [selectedCollectionTypeId, setSelectedCollectionTypeId] = useState<
    number | null
  >(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isInputCheck, setIsInputCheck] = useState(true);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageFilter = new Filter();

  const dropdownItems = collectionTypes.map((type) => ({
    label: type.name,
    value: type.id,
    additionalElement: (
      <Image
        source={{
          uri: `${endpoints.icons}/${type.icon}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "reload",
        }}
        style={{
          width: 28,
          height: 28,
        }}
      />
    ),
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
    },
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
    <CustomOverlay
      isVisible={isCreateNewCollectionOverlayOpen.value}
      onClose={handleOverlayClose}
      overlayTitle={"Create New Collection"}
      footerContent={
        <CustomButton
          title="Create"
          disabled={isSubmitDisabled}
          containerStyle={{ width: "90%", alignSelf: "center" }}
          loading={isPending}
          onPress={handleSubmitCollectionCreation}
        />
      }
    >
      <View
        style={{
          paddingHorizontal: 10,
          justifyContent: "center",
          gap: 20,
          marginTop: 20,
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
      </View>
    </CustomOverlay>
  );
}

export default CreateCollectionForm;
