import { none } from "@/src/const/emptyIdUpdate";
import { endpoints } from "@/src/const/endpoints";
import { useUpdateData } from "@/src/hooks/data_hooks";
import { customTheme } from "@/src/theme/theme";
import User, { UserFrontend } from "@/src/types/entities/user";
import {
  getCountryByCode,
  stringHasValue,
} from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import CountryPicker, { Country } from "react-native-country-picker-modal";
import { Avatar } from "react-native-elements";
import * as RNLocalize from "react-native-localize";
import { ActivityIndicator } from "react-native-paper";
import CustomButton from "../custom_ui/custom_button";
import CustomHTMLView from "../custom_ui/custom_html_view";
import CustomOverlay from "../custom_ui/custom_overlay";
import CustomRichTextEditor from "../custom_ui/custom_rich_text_editor";
import CustomText from "../custom_ui/custom_text";
import TradeReviewsRating from "../otheruser/trade_review_rating";

export interface SettingsUserCardProps {
  user: User | null;
  setUser?: (user: User) => void;
  otherUser?: boolean;
}

function SettingsUserCard({
  user,
  setUser,
  otherUser = false,
}: SettingsUserCardProps) {
  const [isEditModeActive, setIsEditModeActive] = useState(false);

  const locales = RNLocalize.getLocales();
  const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);
  const [isSummaryEditorVisible, setIsSummaryEditorVisible] = useState(false);

  const [country, setCountry] = useState<Country | null>(null);

  const [editModeCountry, setEditModeCountry] = useState(country);
  const [editModeSummary, setEditModeSummary] = useState(user?.summary);
  const [editModeSummaryContent, setEditModeSummaryContent] = useState("");

  const providerIcon =
    user?.provider === "google"
      ? require("../../../assets/images/googlesignin.png")
      : require("../../../assets/images/githubsignin.png");

  const { mutateAsync: updateUser, isPending: isUserUpdatePending } =
    useUpdateData<UserFrontend, User>(endpoints.userFrontend);

  useEffect(() => {
    const fetchCountry = async () => {
      if (user?.country) {
        const countryData = await getCountryByCode(user.country);
        setCountry(countryData);
        setEditModeCountry(countryData);
      }
    };

    fetchCountry();
  }, [user?.country]);

  const handleEditMode = () => {
    if (user === null) return;

    setEditModeCountry(country);
    setEditModeSummary(user?.summary);
    setIsEditModeActive(true);
  };

  const handleSave = async () => {
    if (user === null) return;

    setIsEditModeActive(false);
    const updatedUser = await updateUser({
      id: none,
      value: {
        country: editModeCountry?.cca2.toString() ?? user.country,
        summary: editModeSummary,
      },
    });

    setUser?.(updatedUser);

    console.log(updatedUser.summary);
  };

  const handleCountryEdit = (country: Country) => {
    setEditModeCountry(country);
  };

  const handleBack = () => {
    setIsEditModeActive(false);
  };

  const handleOpenSummaryEdit = () => {
    setEditModeSummaryContent(editModeSummary ?? "");
    setIsSummaryEditorVisible(true);
  };

  const handleApplySummaryEdit = () => {
    if (stringHasValue(editModeSummaryContent)) {
      console.log(editModeSummaryContent);
      setEditModeSummary(editModeSummaryContent);
    } else {
      setEditModeSummary(undefined);
    }
    setIsSummaryEditorVisible(false);
  };

  return (
    <>
      <View
        style={{
          backgroundColor: customTheme.colors.background,
        }}
      >
        <View
          style={{
            width: "100%",
            alignSelf: "center",
            alignItems: "center",
            backgroundColor: customTheme.colors.secondary,
            borderBottomLeftRadius: 50,
            borderBottomRightRadius: 50,
            paddingHorizontal: 10,
            paddingBottom: 10,
          }}
        >
          {!otherUser ? (
            <View style={{ position: "absolute", top: 0, right: 10 }}>
              {isUserUpdatePending ? (
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

          <Avatar
            size={80}
            rounded
            source={user?.avatar ? { uri: user.avatar } : undefined}
            icon={
              !user?.avatar
                ? {
                    name: "user",
                    type: "feather",
                    color: customTheme.colors.secondary,
                  }
                : undefined
            }
            containerStyle={{ backgroundColor: customTheme.colors.primary }}
          />
          <CustomText style={{ fontFamily: "VendSansBold", fontSize: 24 }}>
            {user?.name}
          </CustomText>

          <View
            style={{
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, alignItems: "center" }}>
              {otherUser ? null : (
                <>
                  <CustomText
                    style={{ fontFamily: "VendSansItalic", fontSize: 14 }}
                  >
                    Logged in with
                  </CustomText>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      justifyContent: "center",
                    }}
                  >
                    <Image
                      source={providerIcon}
                      style={{ width: 16, height: 16 }}
                    />
                    <CustomText style={{ fontSize: 18 }}>
                      {user?.provider}
                    </CustomText>
                  </View>
                </>
              )}
              <CustomText
                style={{ fontFamily: "VendSansItalic", fontSize: 14 }}
              >
                Member since
              </CustomText>
              <CustomText style={{ fontSize: 18 }}>
                {new Date(user?.createdAt ?? "").toLocaleDateString()}
              </CustomText>
            </View>

            <View
              style={{
                width: 1,
                height: 40,
                backgroundColor: customTheme.colors.primary,
              }}
            />

            <View
              style={{
                position: "relative",
                flex: 1,
                alignItems: "center",
              }}
            >
              {country?.flag && !isEditModeActive ? (
                <Image
                  source={{ uri: country.flag }}
                  style={{ width: 16, height: 16 }}
                />
              ) : isEditModeActive && editModeCountry?.flag ? (
                <Image
                  source={{ uri: editModeCountry.flag }}
                  style={{ width: 16, height: 16 }}
                />
              ) : null}
              <CustomText style={{ fontSize: 18 }}>
                {isEditModeActive
                  ? editModeCountry?.name.toString()
                  : country?.name.toString()}
              </CustomText>
              {isEditModeActive ? (
                <TouchableOpacity
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "lightgreen",
                    opacity: 0.4,
                    borderWidth: 4,
                    borderColor: "green",
                    borderRadius: 10,
                  }}
                  onPress={() => setIsCountryPickerVisible(true)}
                />
              ) : null}
            </View>
          </View>
          {user ? <TradeReviewsRating userId={user.id} /> : null}
        </View>
      </View>
      <View
        style={{
          position: "relative",
          backgroundColor: customTheme.colors.background,
          paddingTop: 10,
        }}
      >
        <CustomText
          style={{
            fontSize: 18,
            fontFamily: "VendSansBold",
            alignSelf: "center",
          }}
        >
          Summary
        </CustomText>
        {(!stringHasValue(user?.summary) && !isEditModeActive) ||
        (!stringHasValue(editModeSummary) && isEditModeActive) ? (
          <View style={{ marginHorizontal: 10 }}>
            <CustomText style={{ fontFamily: "VendSansItalic" }}>
              {otherUser
                ? "This user has no summary yet."
                : "You don’t have a summary on your profile yet—feel free to add a short introduction so others can get to know you better!"}
            </CustomText>
          </View>
        ) : null}
        <CustomHTMLView
          content={
            isEditModeActive ? (editModeSummary ?? "") : (user?.summary ?? "")
          }
          foldable={true}
        />
        {isEditModeActive ? (
          <TouchableOpacity
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "lightgreen",
              opacity: 0.4,
              borderWidth: 4,
              borderColor: "green",
              borderRadius: 10,
            }}
            onPress={handleOpenSummaryEdit}
          />
        ) : null}
      </View>
      <CountryPicker
        countryCode={
          country?.cca2 ?? (locales?.[0]?.countryCode as any) ?? "EN"
        }
        visible={isCountryPickerVisible}
        onClose={() => setIsCountryPickerVisible(false)}
        onSelect={handleCountryEdit}
        renderFlagButton={() => null}
        withCloseButton={false}
        withFilter={true}
        withFlag={true}
        filterProps={{ style: { marginTop: 100 } }}
      />
      <CustomOverlay
        isVisible={isSummaryEditorVisible}
        onClose={() => setIsSummaryEditorVisible(false)}
        overlayTitle={"Introduct yourself to others!"}
        footerContent={
          <CustomButton
            title={"Apply"}
            containerStyle={{ width: "90%", alignSelf: "center" }}
            onPress={handleApplySummaryEdit}
          />
        }
      >
        <CustomRichTextEditor
          initialContent={editModeSummary ?? ""}
          onChangeValue={(value) => setEditModeSummaryContent(value)}
          placeholder="Share a bit about yourself – who you are, your hobbies, what you like to collect, or anything that shows your personality. Add a fun phrase, use emojis, decorate it as much as you want, and if you have collection-related social media accounts, feel free to include links"
          margin={10}
        />
      </CustomOverlay>
    </>
  );
}

export default SettingsUserCard;
