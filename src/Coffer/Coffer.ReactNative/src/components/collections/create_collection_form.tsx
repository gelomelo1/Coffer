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
import { useTranslation } from "react-i18next";
import { Image, ScrollView } from "react-native";
import NameCheckIcon from "../custom_ui/name_check_icon";
import { stringResource } from "@/src/const/resource";
import { spacing } from "@/src/theme/theme";
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
  const { t } = useTranslation();
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
  >(endpoints.collections, querykeys.collectionsData, t("collections:create.created"));

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
        setErrorMessage(stringResource.loginTextInputRegexError);
        return;
      }

      if (languageFilter.isProfane(newValue)) {
        setErrorMessage(stringResource.profaneError);
        return;
      }

      const collectionsWithCurrentName = (await refetch()).data ?? [];

      if (collectionsWithCurrentName?.length !== 0) {
        setErrorMessage(t("collections:create.nameTaken"));
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
      overlayTitle={t("collections:create.title")}
      footerContent={
        <CustomButton title={t("collections:create.submit")} disabled={isSubmitDisabled} loading={isPending} onPress={handleSubmitCollectionCreation} />
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <CustomDropdown
          open={open}
          value={selectedCollectionTypeId}
          items={dropdownItems}
          setOpen={setOpen}
          setValue={setSelectedCollectionTypeId}
          label={t("collections:create.type")}
          placeholder={t("collections:create.typePlaceholder")}
        />
        <CustomTextInput
          placeholder={t("collections:edit.namePlaceholder")}
          label={t("collections:edit.name")}
          helperText={t("collections:create.nameHelper")}
          value={collectionName}
          onChangeText={(newValue) => handleChangeCollectionName(newValue)}
          errorMessage={errorMessage}
          maxLength={100}
          rightIcon={<NameCheckIcon checking={isFetching} error={!!errorMessage} ok={!isInputCheck && collectionName !== ""} />}
        />
      </ScrollView>
    </CustomOverlay>
  );
}

export default CreateCollectionForm;
