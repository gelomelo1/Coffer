import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomText from "@/src/components/custom_ui/custom_text";
import { endpoints } from "@/src/const/endpoints";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import React, { useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { Button } from "react-native-elements";
import CollectionDeleteForm from "./collection_delete_form";
import CollectionInfoEditForm from "./collection_info_edit_form";

function CollectionInfoCard() {
  const { token } = useUserStore();
  const { collection } = useCollectionStore();

  const [
    isDeleteCollectionConfirmVisible,
    setIsDeleteCollectionConfirmVisible,
  ] = useState(false);

  const [isCollectionInfoEditFormOpen, setIsCollectionInfoEditFormOpen] =
    useState(false);

  return (
    <>
      <View
        style={{
          borderWidth: 4,
          borderColor: customTheme.colors.primary,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          marginHorizontal: 10,
          marginBottom: 20,
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
            {collection.image ? (
              <Image
                source={{
                  uri: `${endpoints.collectionsCoverImage}/${collection.image}`,
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
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
          <View
            style={{
              flex: 1,
            }}
          >
            <CustomText
              style={{ fontFamily: "VendSansBold", fontSize: 20 }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {collection.name}
            </CustomText>
            <CustomText>
              {new Date(collection.createdAt).toLocaleDateString()}
            </CustomText>
            <CustomText style={{ fontFamily: "VendSansBold" }}>
              {collection.follows.length} <CustomText>follower</CustomText>
            </CustomText>
          </View>
        </View>
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
              onPress={() => setIsCollectionInfoEditFormOpen(true)}
            />
          </View>
          <TouchableOpacity
            style={{ flex: 1, marginBottom: -1 }}
            onPress={() => setIsDeleteCollectionConfirmVisible(true)}
          >
            <Button
              title={"Delete"}
              containerStyle={{
                flex: 1,
                borderRadius: 0,
              }}
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
      </View>
      <CollectionDeleteForm
        isDeleteCollectionConfirmVisible={{
          value: isDeleteCollectionConfirmVisible,
          set: setIsDeleteCollectionConfirmVisible,
        }}
      />
      <CollectionInfoEditForm
        isCollectionInfoEditOverlayOpen={{
          value: isCollectionInfoEditFormOpen,
          set: setIsCollectionInfoEditFormOpen,
        }}
      />
    </>
  );
}

export default CollectionInfoCard;
