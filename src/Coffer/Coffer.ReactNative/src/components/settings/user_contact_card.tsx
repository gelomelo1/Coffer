import { endpoints } from "@/src/const/endpoints";
import { useCreateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import {
  UserContact,
  UserContactRequired,
} from "@/src/types/entities/user_contact";
import UserContactBulkPayload, {
  UserContactUpdate,
} from "@/src/types/helpers/user_contact_bulk_playload";
import UserContactPlatfrom from "@/src/types/helpers/user_contact_platform";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  TouchableOpacity,
  View,
} from "react-native";
import { Avatar, Overlay } from "react-native-elements";
import CustomText from "../custom_ui/custom_text";
import TradeReviewsRating from "../otheruser/trade_review_rating";
import AddContactOverlay from "./user_settings/add_contact_overlay";

interface UserContactCardProps {
  user: User | null;
  setUser?: (user: User) => void;
  otherUser?: boolean;
}

function UserContactCard({
  user,
  setUser,
  otherUser = false,
}: UserContactCardProps) {
  const [isEditModeActive, setIsEditModeActive] = useState(false);
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const [isAddContactOverlayVisible, setIsAddContactOverlayVisible] =
    useState(false);
  const [isInformationOverlayVisible, setIsInformationOverlayVisible] =
    useState(false);
  const [editModeUserContacts, setEditModeUserContacts] = useState(
    user?.contacts ?? [],
  );
  const [
    editModeUserContactSelectedPlatform,
    setEditModeUserContactSelectedPlatform,
  ] = useState(UserContactPlatfrom.Phone);
  const [overlayValue, setOverlayValue] = useState("");
  const truncatedContactsRef = useRef<{ [key: number]: boolean }>({});

  const { mutateAsync: updateContacts, isPending: isContactsUpdatePending } =
    useCreateData<UserContactBulkPayload, UserContact[]>(
      endpoints.userContactBulk,
      undefined,
      "Successfully updated your contact data",
      "Failed to update your contact data",
    );

  if (!user) return null;

  const contactsMap: { [key: number]: UserContact | null } = {};
  Object.values(UserContactPlatfrom)
    .filter((v) => typeof v === "number")
    .forEach((type) => {
      const found = user.contacts?.find((c) => c.platform === type) || null;
      contactsMap[type] = found;
    });

  const editContactsMap: { [key: number]: UserContact | null } = {};
  Object.values(UserContactPlatfrom)
    .filter((v) => typeof v === "number")
    .forEach((type) => {
      const found =
        editModeUserContacts.find((c) => c.platform === type) || null;
      editContactsMap[type] = found;
    });

  const handleContactPress = (
    contact: UserContact | null,
    platform: UserContactPlatfrom,
  ) => {
    if (!contact) return;

    const isTruncated = truncatedContactsRef.current[platform];
    if (isTruncated) {
      setOverlayValue(contact.value);
      setIsOverlayVisible(true);
      return;
    }

    switch (platform) {
      case UserContactPlatfrom.Phone:
        Linking.openURL(`tel:${contact.value}`);
        break;
      case UserContactPlatfrom.Email:
        Linking.openURL(`mailto:${contact.value}`);
        break;
      case UserContactPlatfrom.Facebook:
        if (contact.link && contact.fullUrl) Linking.openURL(contact.fullUrl);
        break;
      default:
        break;
    }
  };

  const getIconElement = (platform: UserContactPlatfrom) => {
    switch (platform) {
      case UserContactPlatfrom.Phone:
        return (
          <AntDesign
            name="phone"
            size={24}
            color={customTheme.colors.primary}
          />
        );
      case UserContactPlatfrom.Email:
        return (
          <Entypo name="mail" size={24} color={customTheme.colors.primary} />
        );
      case UserContactPlatfrom.Facebook:
        return (
          <Image
            source={require("../../../assets/images/facebook_icon.png")}
            style={{ width: 24, height: 24 }}
          />
        );
      default:
        return null;
    }
  };

  const handleSave = async () => {
    if (user === null) return;

    setIsEditModeActive(false);

    const editedIds = editModeUserContacts.map((c) => c.id);

    const deleted: string[] = user.contacts
      .filter((c) => !editedIds.includes(c.id))
      .map((c) => c.id);

    const created: UserContactRequired[] = [];
    const updated: UserContactUpdate[] = [];

    editModeUserContacts.forEach((contact) => {
      const { id, createdAt, ...rest } = contact;

      if (contact.id.endsWith("_new")) {
        created.push(rest);
      } else {
        updated.push({
          id,
          value: rest,
        });
      }
    });

    const payload = {
      created,
      updated,
      deleted,
    };

    console.log(JSON.stringify(payload, null, 2));

    const updatedContacts = await updateContacts({ value: payload });

    setUser?.({ ...user, contacts: updatedContacts });
  };

  const handleBack = () => {
    setIsEditModeActive(false);
  };

  const handleEditMode = () => {
    if (!user) return;

    setEditModeUserContacts(user.contacts);
    setIsEditModeActive(true);
  };

  const handleStartEditContact = (platform: UserContactPlatfrom) => {
    setEditModeUserContactSelectedPlatform(platform);
    setIsAddContactOverlayVisible(true);
  };

  const handleEndEditContact = (contact: UserContact) => {
    setEditModeUserContacts((prev) => {
      const index = prev.findIndex((c) => c.id === contact.id);

      if (index === -1) {
        return [...prev, contact];
      }

      return prev.map((c) => (c.id === contact.id ? contact : c));
    });
  };

  const handleDeleteContact = (contact: UserContact) => {
    setEditModeUserContacts((prev) => prev.filter((c) => c.id !== contact.id));
  };

  return (
    <>
      <View style={{ backgroundColor: customTheme.colors.background }}>
        <View
          style={{
            width: "100%",
            backgroundColor: customTheme.colors.secondary,
            borderBottomLeftRadius: 50,
            borderBottomRightRadius: 50,
            paddingTop: otherUser ? 10 : 0,
            paddingHorizontal: 10,
            paddingBottom: 10,
          }}
        >
          <View style={{ height: 60 }}>
            <View style={{ position: "absolute", top: 5, left: 5 }}>
              <TouchableOpacity
                onPress={() => setIsInformationOverlayVisible(true)}
              >
                <Entypo
                  name="info-with-circle"
                  size={24}
                  color={customTheme.colors.primary}
                />
              </TouchableOpacity>
            </View>
            {!otherUser ? (
              <View style={{ position: "absolute", top: 0, right: 10 }}>
                {isContactsUpdatePending ? (
                  <ActivityIndicator
                    size={16}
                    color={customTheme.colors.primary}
                  />
                ) : !isEditModeActive ? (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 5,
                    }}
                    onPress={handleEditMode}
                  >
                    <Entypo
                      name="edit"
                      size={16}
                      color={customTheme.colors.primary}
                    />
                    <CustomText style={{ fontFamily: "VendSansBold" }}>
                      Edit user
                    </CustomText>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={{
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 5,
                      }}
                      onPress={handleSave}
                    >
                      <AntDesign
                        name="check"
                        size={16}
                        color={customTheme.colors.primary}
                      />
                      <CustomText style={{ fontFamily: "VendSansBold" }}>
                        Save
                      </CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 5,
                      }}
                      onPress={handleBack}
                    >
                      <Ionicons
                        name="arrow-back"
                        size={16}
                        color={customTheme.colors.primary}
                      />
                      <CustomText style={{ fontFamily: "VendSansBold" }}>
                        Back
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <View
              style={{
                justifyContent: "space-around",
                alignItems: "center",
                flex: 1,
                marginRight: 20,
              }}
            >
              <Avatar
                size={64}
                rounded
                source={user.avatar ? { uri: user.avatar } : undefined}
                containerStyle={{ backgroundColor: customTheme.colors.primary }}
              />
              <CustomText style={{ fontFamily: "VendSansBold", fontSize: 20 }}>
                {user.name}
              </CustomText>
            </View>

            <View style={{ flex: 2, justifyContent: "flex-start", gap: 20 }}>
              {Object.values(UserContactPlatfrom)
                .filter((v) => typeof v === "number")
                .map((platform) => {
                  const contact = isEditModeActive
                    ? editContactsMap[platform]
                    : contactsMap[platform];

                  return (
                    <View
                      key={platform}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <View style={{ flex: 1, position: "relative" }}>
                        <TouchableOpacity
                          onPress={() => handleContactPress(contact, platform)}
                          style={{ flexDirection: "row", alignItems: "center" }}
                        >
                          {getIconElement(platform)}

                          <View style={{ flex: 1 }}>
                            <CustomText
                              style={{
                                fontSize: 18,
                                position: "absolute",
                                opacity: 0,
                                width: "100%",
                              }}
                              onTextLayout={(e) => {
                                const lines = e.nativeEvent.lines.length;
                                truncatedContactsRef.current[platform] =
                                  lines > 1;
                              }}
                            >
                              {contact?.value ||
                                `No ${UserContactPlatfrom[platform]}`}
                            </CustomText>

                            <CustomText
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={{ fontSize: 18, flexShrink: 1 }}
                            >
                              {contact?.value ||
                                `No ${UserContactPlatfrom[platform]}`}
                            </CustomText>
                          </View>
                        </TouchableOpacity>

                        {isEditModeActive ? (
                          <TouchableOpacity
                            style={{
                              position: "absolute",
                              left: -2,
                              top: -2,
                              bottom: -2,
                              right: -2,
                              backgroundColor: "lightgreen",
                              opacity: 0.4,
                              borderWidth: 4,
                              borderColor: "green",
                              borderRadius: 10,
                              zIndex: 0,
                            }}
                            onPress={() => handleStartEditContact(platform)}
                          />
                        ) : null}
                      </View>

                      {isEditModeActive && contact !== null ? (
                        <TouchableOpacity
                          onPress={() => handleDeleteContact(contact)}
                          style={{
                            padding: 5,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <CustomText
                            style={{
                              color: "red",
                              fontFamily: "VendSansBold",
                              fontSize: 22,
                            }}
                          >
                            ✕
                          </CustomText>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
            </View>
          </View>

          <View
            style={{
              width: "100%",
              flexDirection: "row",
              justifyContent: "flex-start",
              alignItems: "center",
              marginBottom: 10,
              marginLeft: 15,
            }}
          >
            <TradeReviewsRating userId={user.id} />
          </View>
        </View>
      </View>

      <Overlay
        isVisible={isOverlayVisible}
        onBackdropPress={() => setIsOverlayVisible(false)}
        overlayStyle={{
          backgroundColor: customTheme.colors.background,
          marginHorizontal: 10,
        }}
      >
        <View style={{ padding: 10, minWidth: 200 }}>
          <CustomText style={{ fontSize: 16, marginBottom: 10 }}>
            {overlayValue}
          </CustomText>
          <TouchableOpacity
            onPress={() => {
              if (overlayValue.match(/^\+?\d+/)) {
                Linking.openURL(`tel:${overlayValue}`);
              } else {
                Linking.openURL(overlayValue);
              }
              setIsOverlayVisible(false);
            }}
          >
            <CustomText style={{ color: customTheme.colors.primary }}>
              Open
            </CustomText>
          </TouchableOpacity>
        </View>
      </Overlay>

      <Overlay
        isVisible={isInformationOverlayVisible}
        onBackdropPress={() => setIsInformationOverlayVisible(false)}
        overlayStyle={{
          backgroundColor: customTheme.colors.background,
          marginHorizontal: 10,
        }}
      >
        <View style={{ padding: 10, minWidth: 200 }}>
          <CustomText>
            {otherUser
              ? "This is the user’s contact card, showing additional ways you can reach them outside of private chat if that’s more convenient. Please note, this does not replace the private chat—barters must still be completed there in order to finalize the exchange and leave reviews."
              : "Here you can set up your barter contact card with details on how other users can reach you outside of private chat if that’s more convenient. This is an addition to—not a replacement for—the private chat, which is required to complete a barter and receive reviews from the other party. If you don’t use the barter feature, you can safely ignore this section."}
          </CustomText>
        </View>
      </Overlay>

      <AddContactOverlay
        isAddContactOverlayVisible={{
          value: isAddContactOverlayVisible,
          set: setIsAddContactOverlayVisible,
        }}
        user={user}
        selectedPlatform={editModeUserContactSelectedPlatform}
        selectedContact={editModeUserContacts.find(
          (c) => c.platform === editModeUserContactSelectedPlatform,
        )}
        handleEditContact={handleEndEditContact}
      />
    </>
  );
}

export default UserContactCard;
