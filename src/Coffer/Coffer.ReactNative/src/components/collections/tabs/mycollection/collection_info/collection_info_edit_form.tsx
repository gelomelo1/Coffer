import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomImageResize from "@/src/components/custom_ui/custom_image_resize";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomOverlayMessage from "@/src/components/custom_ui/custom_overlay_message";
import CoverImagePicker from "@/src/components/custom_ui/cover_image_picker";
import NameCheckIcon from "@/src/components/custom_ui/name_check_icon";
import RichTextField from "@/src/components/custom_ui/rich_text_field";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { endpoints } from "@/src/const/endpoints";
import { languageFilter, textInputRegex } from "@/src/const/filter";
import { highImageResize } from "@/src/const/image_resize_config";
import { querykeys } from "@/src/const/querykeys";
import { stringResource } from "@/src/const/resource";
import { useCollectionStore } from "@/src/hooks/collection_store";
import {
  useCreateData,
  useGetData,
  useUpdateData,
} from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { spacing } from "@/src/theme/theme";
import {
  Collection,
  CollectionRequired,
} from "@/src/types/entities/collection";
import { pickImage, stringHasValue } from "@/src/utils/data_access_utils";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

interface CollectionInfoEditFormProps {
  isCollectionInfoEditOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function CollectionInfoEditForm({
  isCollectionInfoEditOverlayOpen,
}: CollectionInfoEditFormProps) {
  const { t } = useTranslation();
  const { collection, setCollection } = useCollectionStore();
  const { user, token } = useUserStore();
  const [collectionName, setCollectionName] = useState(collection!.name);
  const [asset, setAsset] = useState<
    ImagePicker.ImagePickerAsset | null | "removable"
  >(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isInputCheck, setIsInputCheck] = useState(false);
  const [isImagePickerLoading, setIsImagePickerLoading] = useState(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPermissionWarningOverlayOpen, setIsPermissionWarningOverlayOpen] =
    useState(false);

  const [descriptionContent, setDescriptionContent] = useState(
    collection!.description,
  );

  const isSubmitDisabled = collectionName === "" || isInputCheck;

  const { isFetching, refetch } = useGetData<Collection>(
    endpoints.collections,
    querykeys.collectionsWithCurrentName,
    {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user!.id,
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

  const {
    mutateAsync: updateCollection,
    isPending: isCollectionUpdatePending,
  } = useUpdateData<CollectionRequired, Collection>(
    endpoints.collections,
    querykeys.collectionsData,
    asset ? "" : undefined,
  );

  const {
    mutateAsync: uploadCoverImage,
    isPending: isUploadCoverImagePending,
  } = useCreateData<FormData, Collection>(
    endpoints.collectionsCoverImageUpload,
    querykeys.collectionsData,
    t("collections:edit.updated"),
    undefined,
    {
      "Content-Type": "multipart/form-data",
    },
  );

  const resetFormData = (isEditSaved: boolean) => {
    if (!isEditSaved) {
      setCollectionName(collection!.name);
      setDescriptionContent(collection!.description);
    }
    setAsset(null);
    setErrorMessage("");
    setIsInputCheck(false);
    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
  };

  const handleOverlayClose = (isEditSaved: boolean) => {
    if (isCollectionUpdatePending || isUploadCoverImagePending) return;
    resetFormData(isEditSaved);
    isCollectionInfoEditOverlayOpen.set(false);
  };

  const descriptionUploadContent = stringHasValue(descriptionContent)
    ? descriptionContent
    : undefined;

  const handleUpdate = async () => {
    let isEditSaved = true;
    try {
      let newValue = await updateCollection({
        id: collection!.id,
        value: {
          userId: collection!.userId,
          collectionTypeId: collection!.collectionTypeId,
          name: collectionName,
          description: descriptionUploadContent,
        },
      });
      const formData = new FormData();
      if (asset) {
        if (asset !== "removable") {
          formData.append("file", {
            uri: asset.uri,
            name: asset.fileName ?? "upload.jpg",
            type: asset.mimeType ?? "image/jpeg",
          } as any);
        } else {
          formData.append("file", "");
        }
        newValue = await uploadCoverImage({
          id: collection!.id,
          value: formData,
        });
      }
      setCollectionName(newValue.name);
      setCollection(newValue);
    } catch (error) {
      isEditSaved = false;
      console.error("Failed to update collection:", error);
    } finally {
      handleOverlayClose(isEditSaved);
    }
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
      if (!textInputRegex.test(newValue)) {
        setErrorMessage(stringResource.textInputRegexError);
        return;
      }

      if (languageFilter.isProfane(newValue)) {
        setErrorMessage(stringResource.profaneError);
        return;
      }

      const collectionsWithCurrentName = (await refetch()).data ?? [];

      if (collectionsWithCurrentName?.length !== 0) {
        setErrorMessage(stringResource.alreadyExistsError);
        return;
      }

      setErrorMessage("");
      setIsInputCheck(false);
    }, 1000);
  };

  const handleImagePick = async () => {
    setIsImagePickerLoading(true);

    const result = await pickImage("gallery");

    switch (result.status) {
      case "success":
        const image = result.assets[0];
        setAsset(image);
        break;
      case "cancel":
        setIsImagePickerLoading(false);
        setAsset(null);
        break;
      case "error":
        console.log("Error occured during gallery open", result.error);
        setIsImagePickerLoading(false);
        setAsset(null);
        break;
      case "permission_denied":
        setIsImagePickerLoading(false);
        setIsPermissionWarningOverlayOpen(true);
        setAsset(null);
        break;
    }
  };

  const handlePermissionWarningOverlayClose = () => {
    setIsPermissionWarningOverlayOpen(false);
  };

  return (
    <>
      <CustomOverlay
        isVisible={isCollectionInfoEditOverlayOpen.value}
        onClose={() => handleOverlayClose(false)}
        overlayTitle={t("collections:edit.title")}
        footerContent={
          <CustomButton
            title={t("collections:edit.save")}
            loading={isCollectionUpdatePending || isUploadCoverImagePending}
            onPress={handleUpdate}
            disabled={isSubmitDisabled}
          />
        }
      >
        <KeyboardAwareScrollView
          enableOnAndroid
          extraScrollHeight={spacing.xxl}
          enableResetScrollToCoords={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl }}
        >
          <CoverImagePicker
            label={t("collections:edit.coverImage")}
            emptyText={t("collections:edit.noCoverImage")}
            changeLabel={t("collections:edit.changeCover")}
            removeLabel={t("collections:edit.removeCover")}
            loading={isImagePickerLoading}
            uri={asset && asset !== "removable" ? asset.uri : collection!.image && asset !== "removable" ? `${endpoints.collectionsCoverImage}/${collection!.image}` : null}
            headers={asset && asset !== "removable" ? undefined : { Authorization: `Bearer ${token}` }}
            onPick={handleImagePick}
            onRemove={() => setAsset("removable")}
          />
          <CustomTextInput
            placeholder={t("collections:edit.namePlaceholder")}
            label={t("collections:edit.name")}
            value={collectionName}
            onChangeText={(newValue) => handleChangeCollectionName(newValue)}
            errorMessage={errorMessage}
            maxLength={100}
            rightIcon={<NameCheckIcon checking={isFetching} error={!!errorMessage} ok={!isInputCheck && collectionName !== ""} />}
          />
          <RichTextField
            label={t("collections:edit.description")}
            value={descriptionContent ?? ""}
            onChangeValue={(value) => setDescriptionContent(value)}
            placeholder={t("collections:edit.descriptionPlaceholder")}
          />
        </KeyboardAwareScrollView>
      </CustomOverlay>
      <CustomOverlayMessage
        isVisible={isPermissionWarningOverlayOpen}
        onClose={handlePermissionWarningOverlayClose}
        overlayTitle={t("items:permissions.galleryTitle")}
        message={t("items:permissions.galleryText")}
      />
      {asset !== null && asset !== "removable" ? (
        <CustomImageResize
          width={highImageResize.width}
          compress={highImageResize.compress}
          asset={asset}
          setAsset={setAsset}
          onComplete={() => setIsImagePickerLoading(false)}
        />
      ) : null}
    </>
  );
}

export default CollectionInfoEditForm;
