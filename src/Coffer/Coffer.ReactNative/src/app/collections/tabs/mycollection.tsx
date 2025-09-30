import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import RootView from "@/src/components/custom_ui/root_view";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useDeleteData, useUpdateData } from "@/src/hooks/data_hooks";
import { useResetNavigation } from "@/src/hooks/navigation";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import {
  Collection,
  CollectionRequired,
} from "@/src/types/entities/collection";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import Foundation from "@expo/vector-icons/Foundation";
import { useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { Button, Overlay } from "react-native-elements";

function MyCollection() {
  const { user } = useUserStore();
  const { collectionType, collection, setCollection } = useCollectionStore();

  const [isEditing, setIsEditing] = useState(false);
  const [
    isDeleteCollectionConfirmVisible,
    setIsDeleteCollectionConfirmVisible,
  ] = useState(false);

  const [collectionName, setCollectionName] = useState(collection.name);

  const { mutateAsync: deleteCollection, isPending: isDeletePending } =
    useDeleteData(endpoints.collections);

  const { mutateAsync: updateCollection, isPending: isUpdatePending } =
    useUpdateData<CollectionRequired, Collection>(endpoints.collections);

  const handleOverlayClose = () => {
    if (isDeletePending) return;

    setIsDeleteCollectionConfirmVisible(false);
  };

  const resetNavigate = useResetNavigation();

  const handleDelete = async () => {
    try {
      await deleteCollection(collection.id);
      handleOverlayClose();
      resetNavigate({
        pathname: ROUTES.COLLECTIONS.ROOT,
        params: pageParams.collections(user.name),
      });
    } catch (error) {
      handleOverlayClose();
      console.error("Failed to delete collection:", error);
    }
  };

  const resetEdit = () => {
    setCollectionName(collection.name);
    setIsEditing(false);
  };

  const handleUpdate = async () => {
    try {
      const updatedValue = await updateCollection({
        id: collection.id,
        value: {
          userId: collection.userId,
          collectionTypeId: collection.collectionTypeId,
          name: collectionName,
        },
      });
      setCollection(updatedValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update collection:", error);
      resetEdit();
    }
  };
  return (
    <RootView color={collectionType.color}>
      <View
        style={{
          borderWidth: 4,
          borderColor: isEditing
            ? customTheme.colors.secondary
            : customTheme.colors.primary,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
      >
        <View
          style={{
            height: 150,
            flexDirection: "row",
            margin: 5,
            marginBottom: 10,
            gap: 5,
          }}
        >
          <View
            style={{
              position: "relative",
              width: 150,
              borderWidth: 1,
              borderColor: customTheme.colors.primary,
              justifyContent: "center",
            }}
          >
            {isEditing ? (
              <View
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
              >
                <Entypo name="image" size={32} color="black" />
              </View>
            ) : null}
            {
              <CustomText
                style={{
                  fontFamily: "VendSansItalic",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                No cover image uploaded
              </CustomText>
            }
          </View>
          <View
            style={{
              flex: 1,
            }}
          >
            {isEditing ? (
              <TextInput
                value={collectionName}
                onChangeText={(newValue) => setCollectionName(newValue)}
                style={{
                  borderWidth: 0,
                  borderBottomWidth: 1,
                  borderColor: customTheme.colors.secondary,
                  paddingLeft: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                  color: customTheme.colors.primary,
                  fontSize: 20,
                }}
              />
            ) : (
              <CustomText
                style={{ fontFamily: "VendSansBold", fontSize: 20 }}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {collection.name}
              </CustomText>
            )}
            <CustomText>
              {new Date(collection.createdAt).toLocaleDateString()}
            </CustomText>
          </View>
        </View>
        {isEditing ? (
          <View
            style={{
              flexDirection: "row",
              marginBottom: 1,
            }}
          >
            <View
              style={{
                flex: 1,
                marginRight: 1,
              }}
            >
              <CustomButton
                title={"Back"}
                onPress={resetEdit}
                disabled={isUpdatePending}
              />
            </View>
            <TouchableOpacity style={{ flex: 1 }} onPress={handleUpdate}>
              <Button
                title={"Save"}
                containerStyle={{ flex: 1, borderRadius: 0 }}
                disabled={true}
                disabledStyle={{
                  flex: 1,
                  backgroundColor: "green",
                  borderRadius: 0,
                }}
                disabledTitleStyle={{ color: "white" }}
                icon={<Foundation name="save" size={20} color="white" />}
                loading={isUpdatePending}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={{
              flexDirection: "row",
              marginBottom: 1,
            }}
          >
            <View
              style={{
                flex: 1,
                marginRight: 1,
              }}
            >
              <CustomButton
                title={"Edit"}
                icon={
                  <Entypo
                    name="edit"
                    size={20}
                    color={customTheme.colors.secondary}
                    style={{ marginRight: 5 }}
                  />
                }
                onPress={() => setIsEditing(true)}
              />
            </View>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setIsDeleteCollectionConfirmVisible(true)}
            >
              <Button
                title={"Delete"}
                containerStyle={{ flex: 1, borderRadius: 0 }}
                disabled={true}
                disabledStyle={{
                  flex: 1,
                  backgroundColor: "red",
                  borderRadius: 0,
                }}
                disabledTitleStyle={{ color: "white" }}
                icon={
                  <AntDesign
                    name="delete"
                    size={20}
                    color={"white"}
                    style={{ marginRight: 5 }}
                  />
                }
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Overlay
        isVisible={isDeleteCollectionConfirmVisible}
        onBackdropPress={handleOverlayClose}
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
          <CustomText>
            Are you sure you want to delete{" "}
            <CustomText style={{ fontFamily: "VendSansBold" }}>
              {collection.name}
            </CustomText>{" "}
            collection?
          </CustomText>
          <CustomButton
            title={"Delete"}
            loading={isDeletePending}
            onPress={handleDelete}
          />
        </View>
      </Overlay>
    </RootView>
  );
}

export default MyCollection;
