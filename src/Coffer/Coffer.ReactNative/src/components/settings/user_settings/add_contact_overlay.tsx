import { endpoints } from "@/src/const/endpoints";
import {
  facebookRegex,
  instagramDomainRegex,
  instagramRegex,
  languageFilter,
  phoneRegex,
} from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import { useCreateData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { customTheme } from "@/src/theme/theme";
import {
  UserContact,
  UserContactRequired,
} from "@/src/types/entities/user_contact";
import { CONTACT_TYPES, ContactType } from "@/src/types/helpers/contact_type";
import React, { useState } from "react";
import { Overlay } from "react-native-elements";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../custom_ui/custom_button";
import CustomDropdown from "../../custom_ui/custom_dropdown";
import CustomTextInput from "../../custom_ui/custom_text_input";

interface AddContactOverlayProps {
  isAddContactOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function AddContactOverlay({
  isAddContactOverlayVisible,
}: AddContactOverlayProps) {
  const { user, setUser } = useUserStore();

  const { mutateAsync: insertContact, isPending } = useCreateData<
    UserContactRequired,
    UserContact
  >(
    endpoints.userContact,
    undefined,
    "Contact info added successfully",
    "Failed to add contact info"
  );

  const [selectedContactPlatform, setSelectedContactPlatform] =
    useState<ContactType | null>(null);

  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false);

  const [contactValue, setContactValue] = useState("");
  const [linkValue, setLinkValue] = useState<string | null>(null);

  // Track focus for showing errors only when input is blurred
  const [isContactFocused, setIsContactFocused] = useState(false);
  const [isLinkFocused, setIsLinkFocused] = useState(false);

  // Only show platforms not already added by the user
  const availablePlatforms = CONTACT_TYPES.filter(
    (type) => !user?.contacts.some((c) => c.platform === type)
  );

  const items = availablePlatforms.map((type) => ({
    label: type,
    value: type,
  }));

  const handleOverlayClose = () => {
    setSelectedContactPlatform(null);
    setContactValue("");
    setLinkValue(null);
    setIsContactFocused(false);
    setIsLinkFocused(false);
    isAddContactOverlayVisible.set(false);
  };

  const handleChangeSelectedPlatform = (
    newValue: React.SetStateAction<ContactType | null>
  ) => {
    setSelectedContactPlatform(newValue);
    setContactValue("");
    setLinkValue(null);
    setIsContactFocused(false);
    setIsLinkFocused(false);
  };

  const getPhoneNumberFieldError = () => {
    if (contactValue === "") return stringResource.requiredError;
    if (languageFilter.isProfane(contactValue))
      return stringResource.profaneError;
    if (!phoneRegex.test(contactValue))
      return stringResource.notValidPhoneNumberError;
  };

  const getFacebookNameFieldError = () => {
    if (contactValue === "") return stringResource.requiredError;
    if (languageFilter.isProfane(contactValue))
      return stringResource.profaneError;
  };

  const getFacebookLinkFieldError = () => {
    if (!linkValue || linkValue === "") return stringResource.requiredError;
    if (languageFilter.isProfane(linkValue)) return stringResource.profaneError;
    if (!facebookRegex.test(linkValue))
      return stringResource.notValidFacebookLink;
  };

  const getInstagramNameFieldError = () => {
    if (contactValue === "") return stringResource.requiredError;
    if (languageFilter.isProfane(contactValue))
      return stringResource.profaneError;
    if (!instagramRegex.test(contactValue))
      return stringResource.notValidInstagramUsername;
  };

  const getInstagramLinkFieldError = () => {
    if (!linkValue || linkValue === "") return stringResource.requiredError;
    if (languageFilter.isProfane(linkValue)) return stringResource.profaneError;
    if (!instagramDomainRegex.test(linkValue))
      return stringResource.notValidInstagramLink;
  };

  // Determine the error for the current platform (used for button disabling)
  const getCurrentFieldError = () => {
    switch (selectedContactPlatform) {
      case "Phone":
        return getPhoneNumberFieldError();
      case "Facebook":
        return getFacebookNameFieldError() || getFacebookLinkFieldError();
      case "Instagram":
        return getInstagramNameFieldError() || getInstagramLinkFieldError();
      default:
        return undefined;
    }
  };

  const handleAddContactPressed = async () => {
    if (!selectedContactPlatform || !user) return;

    try {
      const response = await insertContact({
        value: {
          userId: user.id,
          platform: selectedContactPlatform,
          value: contactValue,
          link: linkValue ?? undefined,
        },
      });
      setUser({ ...user, contacts: [...user.contacts, response] });
    } catch (e) {
      console.error(e);
    }

    handleOverlayClose();
  };

  return (
    <Overlay
      fullScreen
      isVisible={isAddContactOverlayVisible.value}
      overlayStyle={{ backgroundColor: customTheme.colors.background }}
      onBackdropPress={handleOverlayClose}
    >
      <SafeAreaView
        style={{
          flex: 1,
          padding: 10,
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
        }}
      >
        <CustomDropdown
          label="Contact platform"
          value={selectedContactPlatform}
          open={isPlatformDropdownOpen}
          setOpen={setIsPlatformDropdownOpen}
          items={items}
          setValue={(newValue) => handleChangeSelectedPlatform(newValue)}
        />

        {selectedContactPlatform === "Phone" && (
          <CustomTextInput
            label="Phone number"
            placeholder="Please enter your phone number"
            onFocus={() => setIsContactFocused(true)}
            onBlur={() => setIsContactFocused(false)}
            onChangeText={(newValue) => setContactValue(newValue)}
            errorMessage={
              !isContactFocused ? getPhoneNumberFieldError() : undefined
            }
          />
        )}

        {selectedContactPlatform === "Facebook" && (
          <>
            <CustomTextInput
              label="Facebook name"
              placeholder="Please enter your Facebook name"
              onFocus={() => setIsContactFocused(true)}
              onBlur={() => setIsContactFocused(false)}
              onChangeText={(newValue) => setContactValue(newValue)}
              errorMessage={
                !isContactFocused ? getFacebookNameFieldError() : undefined
              }
            />
            <CustomTextInput
              label="Facebook link"
              placeholder="Please paste your Facebook account's link"
              onFocus={() => setIsLinkFocused(true)}
              onBlur={() => setIsLinkFocused(false)}
              onChangeText={(newValue) => setLinkValue(newValue)}
              errorMessage={
                !isLinkFocused ? getFacebookLinkFieldError() : undefined
              }
            />
          </>
        )}

        {selectedContactPlatform === "Instagram" && (
          <>
            <CustomTextInput
              label="Instagram username"
              placeholder="Please enter your Instagram name"
              onFocus={() => setIsContactFocused(true)}
              onBlur={() => setIsContactFocused(false)}
              onChangeText={(newValue) => setContactValue(newValue)}
              errorMessage={
                !isContactFocused ? getInstagramNameFieldError() : undefined
              }
            />
            <CustomTextInput
              label="Instagram link"
              placeholder="Please paste your Instagram account's link"
              onFocus={() => setIsLinkFocused(true)}
              onBlur={() => setIsLinkFocused(false)}
              onChangeText={(newValue) => setLinkValue(newValue)}
              errorMessage={
                !isLinkFocused ? getInstagramLinkFieldError() : undefined
              }
            />
          </>
        )}

        <CustomButton
          title={"Add"}
          containerStyle={{ marginTop: 10 }}
          loading={isPending}
          disabled={!!getCurrentFieldError()}
          onPress={handleAddContactPressed}
        />
      </SafeAreaView>
    </Overlay>
  );
}

export default AddContactOverlay;
