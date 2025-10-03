import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { ComponentLoading } from "@/src/components/custom_ui/loading";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
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
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import * as ImagePicker from "expo-image-picker";
import { Filter } from "profanity-check";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import { Icon, Overlay } from "react-native-elements";

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
  const { user } = useUserStore();
  const [collectionName, setCollectionName] = useState(collection.name);
  const [asset, setAsset] = useState<
    ImagePicker.ImagePickerAsset | null | "removable"
  >(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isInputCheck, setIsInputCheck] = useState(false);
  const [isImagePickerLoading, setIsImagePickerLoading] = useState(false);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageFilter = new Filter();

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
    }
  );

  const {
    mutateAsync: updateCollection,
    isPending: isCollectionUpdatePending,
  } = useUpdateData<CollectionRequired, Collection>(
    endpoints.collections,
    querykeys.collectionsData,
    asset ? "" : undefined
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
    }
  );

  const resetFormData = (isEditSaved: boolean) => {
    if (!isEditSaved) setCollectionName(collection.name);
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

  const handleUpdate = async () => {
    let isEditSaved = true;
    try {
      let newValue = await updateCollection({
        id: collection.id,
        value: {
          userId: collection.userId,
          collectionTypeId: collection.collectionTypeId,
          name: collectionName,
        },
      });
      const formData = new FormData();
      if (asset && asset !== "removable") {
        formData.append("file", {
          uri: asset.uri,
          name: asset.fileName ?? "upload.jpg",
          type: asset.mimeType ?? "image/jpeg",
        } as any);
      } else {
        formData.append("file", "");
      }
      newValue = await uploadCoverImage({
        id: collection.id,
        value: formData,
      });
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

  const handleImagePick = async () => {
    setIsImagePickerLoading(true);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
    });
    setIsImagePickerLoading(false);
    if (result.canceled) return;
    const asset = result.assets[0];
    setAsset(asset);
    console.log(result);
  };

  return (
    <Overlay
      isVisible={isCollectionInfoEditOverlayOpen.value}
      onBackdropPress={() => handleOverlayClose(false)}
      overlayStyle={{
        backgroundColor: customTheme.colors.background,
      }}
    >
      <View
        style={{
          position: "relative",
          width: "90%",
        }}
      >
        <CustomText style={{ fontFamily: "VendSansBold", marginBottom: 2 }}>
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
                style={{ width: "100%", height: "100%" }}
              />
            ) : collection.image && asset !== "removable" ? (
              <Image
                source={{
                  uri: `${endpoints.collectionsCoverImage}/${collection.image}`,
                  cache: "reload",
                }}
                style={{ width: "100%", height: "100%" }}
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
            title={"Edit collection"}
            loading={isCollectionUpdatePending || isUploadCoverImagePending}
            onPress={handleUpdate}
            disabled={isSubmitDisabled}
          />
        </View>
      </View>
    </Overlay>
  );
}

export default CollectionInfoEditForm;
