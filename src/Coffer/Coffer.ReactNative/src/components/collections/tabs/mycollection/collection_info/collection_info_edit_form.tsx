import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomImageResize from "@/src/components/custom_ui/custom_image_resize";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomOverlayMessage from "@/src/components/custom_ui/custom_overlay_message";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { ComponentLoading } from "@/src/components/custom_ui/loading";
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
import { customTheme } from "@/src/theme/theme";
import {
  Collection,
  CollectionRequired,
} from "@/src/types/entities/collection";
import { pickImage, stringHasValue } from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Icon } from "react-native-elements";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import CustomRichTextEditor from "../../../../custom_ui/custom_rich_text_editor";

interface CollectionInfoEditFormProps {
  isCollectionInfoEditOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function CollectionInfoEditForm({
  isCollectionInfoEditOverlayOpen,
}: CollectionInfoEditFormProps) {
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
    "Successfully updated",
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
        overlayTitle={"Edit Collection"}
        footerContent={
          <CustomButton
            title={"Edit"}
            containerStyle={{ width: "90%", alignSelf: "center" }}
            loading={isCollectionUpdatePending || isUploadCoverImagePending}
            onPress={handleUpdate}
            disabled={isSubmitDisabled}
          />
        }
      >
        <KeyboardAwareScrollView
          enableOnAndroid
          extraScrollHeight={100}
          enableResetScrollToCoords={false}
        >
          <View
            style={{
              paddingHorizontal: 10,
              justifyContent: "center",
              gap: 20,
            }}
          >
            <CustomText
              style={{
                fontFamily: "VendSansBold",
                marginBottom: 2,
                marginTop: 10,
              }}
            >
              Collection cover image
            </CustomText>
            <View
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  position: "relative",
                  width: 150,
                  height: 150,
                  justifyContent: "center",
                }}
              >
                {isImagePickerLoading ? <ComponentLoading /> : null}
                <Pressable
                  style={{
                    position: "absolute",
                    top: -1,
                    right: -1,
                    bottom: -1,
                    left: -1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderWidth: 3,
                    borderColor: "grey",
                    borderStyle: "dashed",
                    zIndex: 1,
                  }}
                  onPress={handleImagePick}
                >
                  <Entypo name="image" size={32} color="black" />
                </Pressable>

                {asset && asset !== "removable" ? (
                  <Image
                    source={{
                      uri: asset.uri,
                      cache: "reload",
                    }}
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      resizeMode: "cover",
                    }}
                  />
                ) : collection!.image && asset !== "removable" ? (
                  <Image
                    source={{
                      uri: `${endpoints.collectionsCoverImage}/${collection!.image}`,
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                      cache: "reload",
                    }}
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      resizeMode: "cover",
                    }}
                  />
                ) : (
                  <CustomText
                    style={{
                      fontFamily: "VendSansItalic",
                      fontSize: 14,
                      textAlign: "center",
                    }}
                  >
                    No cover image uploaded
                  </CustomText>
                )}
              </View>
              <CustomButton
                title={"Clear"}
                containerStyle={{
                  width: 150,
                  alignSelf: "center",
                  borderRadius: 40,
                }}
                buttonStyle={{
                  borderRadius: 40,
                }}
                icon={
                  <AntDesign
                    name="clear"
                    size={18}
                    color={customTheme.colors.secondary}
                    style={{ marginRight: 5 }}
                  />
                }
                onPress={() => setAsset("removable")}
              />
              <CustomTextInput
                placeholder="Enter a name for your collection"
                label="Collection name"
                containerStyle={{ marginBottom: 20 }}
                value={collectionName}
                onChangeText={(newValue) =>
                  handleChangeCollectionName(newValue)
                }
                errorMessage={errorMessage}
                rightIcon={
                  isFetching ? (
                    <ActivityIndicator
                      size="small"
                      color={customTheme.colors.accent}
                    />
                  ) : !!errorMessage ? (
                    <Icon name="close" size={20} color="red" />
                  ) : !isInputCheck ? (
                    <Icon name="check" size={20} color="green" />
                  ) : undefined
                }
              />
            </View>
          </View>
          <CustomText style={{ fontFamily: "VendSansBold", marginLeft: 10 }}>
            Description
          </CustomText>
          <CustomRichTextEditor
            initialContent={collection?.description ?? ""}
            onChangeValue={(value) => setDescriptionContent(value)}
            placeholder="What’s in your collection, and how do you find your pieces? Rare classics, everyday finds, or a bit of everything — tell your story."
            richTextHeight={600}
            keyboadVerticalOffset={188}
            margin={10}
          />
        </KeyboardAwareScrollView>
      </CustomOverlay>
      <CustomOverlayMessage
        isVisible={isPermissionWarningOverlayOpen}
        onClose={handlePermissionWarningOverlayClose}
        overlayTitle={"Gallery Permission"}
        message={
          "Gallery permission is required to add items and enable the item duplication detection feature. Please allow access to continue."
        }
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
