import emptyUserContact from "@/src/const/empty_user_contact";
import {
  emailRegex,
  facebookRegex,
  languageFilter,
  phoneRegex,
} from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import { customTheme } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { UserContact } from "@/src/types/entities/user_contact";
import UserContactPlatfrom from "@/src/types/helpers/user_contact_platform";
import { stringHasValue } from "@/src/utils/data_access_utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../custom_ui/custom_button";
import CustomOverlay from "../../custom_ui/custom_overlay";
import CustomText from "../../custom_ui/custom_text";
import CustomTextInput from "../../custom_ui/custom_text_input";

interface AddContactOverlayProps {
  isAddContactOverlayVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  user: User;
  selectedPlatform: UserContactPlatfrom;
  selectedContact?: UserContact;
  handleEditContact: (newValue: UserContact) => void;
}

function AddContactOverlay({
  isAddContactOverlayVisible,
  user,
  selectedPlatform,
  selectedContact,
  handleEditContact,
}: AddContactOverlayProps) {
  const [value, setValue] = useState(
    emptyUserContact("", "", UserContactPlatfrom.Phone),
  );

  const [contactError, setContactError] = useState<string | undefined>();
  const [linkError, setLinkError] = useState<string | undefined>();
  const [isCheckingError, setIsCheckingError] = useState(false);

  const contactDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const linkDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isAddContactOverlayVisible.value) {
      if (selectedContact) {
        setValue(selectedContact);
      } else {
        const existingContact = user.contacts.find(
          (c) => c.platform === selectedPlatform,
        );

        setValue(
          emptyUserContact(
            existingContact ? existingContact.id : `${selectedPlatform}_new`,
            user.id,
            selectedPlatform,
          ),
        );
      }

      setContactError(
        validateContact(selectedPlatform, selectedContact?.value ?? ""),
      );
      setLinkError(
        selectedPlatform === UserContactPlatfrom.Facebook
          ? getFacebookLinkFieldError(selectedContact?.link ?? "")
          : undefined,
      );

      setIsCheckingError(false);
    }
  }, [isAddContactOverlayVisible.value, selectedContact, selectedPlatform]);

  const handleOverlayClose = () => {
    setContactError(undefined);
    setLinkError(undefined);
    isAddContactOverlayVisible.set(false);
  };

  /** Validation functions that take the input value */
  const getPhoneNumberFieldError = (val: string) => {
    if (!stringHasValue(val)) return stringResource.requiredError;
    if (languageFilter.isProfane(val)) return stringResource.profaneError;
    if (!phoneRegex.test(val)) return stringResource.notValidPhoneNumberError;
    return undefined;
  };

  const getFacebookNameFieldError = (val: string) => {
    if (!stringHasValue(val)) return stringResource.requiredError;
    if (languageFilter.isProfane(val)) return stringResource.profaneError;
    return undefined;
  };

  const getFacebookLinkFieldError = (val: string) => {
    if (!stringHasValue(val)) return stringResource.requiredError;
    if (languageFilter.isProfane(val)) return stringResource.profaneError;
    if (!facebookRegex.test(val))
      return stringResource.notValidFacebookUsername;
    return undefined;
  };

  const getEmailAddressFieldError = (val: string) => {
    if (!stringHasValue(val)) return stringResource.requiredError;
    if (languageFilter.isProfane(val)) return stringResource.profaneError;
    if (!emailRegex.test(val)) return stringResource.notValidEmailAddress;
    return undefined;
  };

  /** Generic contact validation */
  const validateContact = (platform: UserContactPlatfrom, val: string) => {
    switch (platform) {
      case UserContactPlatfrom.Phone:
        return getPhoneNumberFieldError(val);
      case UserContactPlatfrom.Facebook:
        return getFacebookNameFieldError(val);
      case UserContactPlatfrom.Email:
        return getEmailAddressFieldError(val);
      default:
        return undefined;
    }
  };

  /** Contact input change handler with debounce */
  const handleContactChange = (newValue: string) => {
    setValue((prev) => ({ ...prev, value: newValue }));

    if (contactDebounceTimer.current)
      clearTimeout(contactDebounceTimer.current);

    setIsCheckingError(true);

    contactDebounceTimer.current = setTimeout(() => {
      const error = validateContact(value.platform, newValue);
      setContactError(error);
      setIsCheckingError(false);
    }, 500);
  };

  /** Link input change handler with debounce */
  const handleLinkChange = (newValue: string) => {
    setValue((prev) => ({ ...prev, link: newValue }));

    if (linkDebounceTimer.current) clearTimeout(linkDebounceTimer.current);

    setIsCheckingError(true);

    linkDebounceTimer.current = setTimeout(() => {
      const error =
        value.platform === UserContactPlatfrom.Facebook
          ? getFacebookLinkFieldError(newValue)
          : undefined;
      setLinkError(error);
      setIsCheckingError(false);
    }, 500);
  };

  const handleEditPress = () => {
    handleEditContact(value);
    handleOverlayClose();
  };

  return (
    <CustomOverlay
      isVisible={isAddContactOverlayVisible.value}
      onClose={handleOverlayClose}
      overlayTitle={`Edit ${UserContactPlatfrom[value.platform]} contact`}
      footerContent={
        <CustomButton
          title="Edit"
          containerStyle={{ width: "90%", alignSelf: "center" }}
          onPress={handleEditPress}
          disabled={!!contactError || !!linkError || isCheckingError}
        />
      }
    >
      <SafeAreaView
        style={{
          flex: 1,
          padding: 10,
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 20,
        }}
      >
        {value.platform === UserContactPlatfrom.Facebook && (
          <View>
            <CustomText style={{ fontFamily: "VendSansBold", marginBottom: 5 }}>
              How to find your Facebook username:
            </CustomText>
            <CustomText>• Open Facebook on your mobile device.</CustomText>
            <CustomText>
              • Tap{" "}
              <AntDesign
                name="menu"
                size={16}
                color={customTheme.colors.primary}
              />{" "}
              <CustomText style={{ fontFamily: "VendSansBold" }}>
                Menu
              </CustomText>{" "}
              in the top left of Facebook.
            </CustomText>
            <CustomText>
              • Tap{" "}
              <CustomText style={{ fontFamily: "VendSansBold" }}>
                Settings and privacy,
              </CustomText>{" "}
              then tap{" "}
              <CustomText style={{ fontFamily: "VendSansBold" }}>
                Settings.
              </CustomText>
            </CustomText>
            <CustomText>
              • Tap{" "}
              <CustomText style={{ fontFamily: "VendSansBold" }}>
                Accounts Centre,
              </CustomText>{" "}
              then tap{" "}
              <CustomText style={{ fontFamily: "VendSansBold" }}>
                Profiles.
              </CustomText>
            </CustomText>
            <CustomText>
              • Choose a profile, then tap{" "}
              <CustomText style={{ fontFamily: "VendSansBold" }}>
                Username.
              </CustomText>
            </CustomText>
          </View>
        )}

        {value.platform === UserContactPlatfrom.Phone && (
          <CustomTextInput
            label="Phone number"
            placeholder="Please enter your phone number"
            value={value.value}
            onChangeText={handleContactChange}
            onFocus={() => setIsCheckingError(true)}
            onBlur={() => {
              const error = validateContact(value.platform, value.value);
              setContactError(error);
              setIsCheckingError(false);
            }}
            errorMessage={contactError}
          />
        )}

        {value.platform === UserContactPlatfrom.Facebook && (
          <>
            <CustomTextInput
              label="Facebook name"
              placeholder="Please enter your full name"
              value={value.value}
              onChangeText={handleContactChange}
              onFocus={() => setIsCheckingError(true)}
              onBlur={() => {
                const error = validateContact(value.platform, value.value);
                setContactError(error);
                setIsCheckingError(false);
              }}
              errorMessage={contactError}
            />

            <CustomTextInput
              label="Facebook username"
              placeholder="Please enter your Facebook username"
              value={value.link}
              onChangeText={handleLinkChange}
              onFocus={() => setIsCheckingError(true)}
              onBlur={() => {
                const error =
                  value.platform === UserContactPlatfrom.Facebook
                    ? getFacebookLinkFieldError(value.link ?? "")
                    : undefined;
                setLinkError(error);
                setIsCheckingError(false);
              }}
              errorMessage={linkError}
            />
          </>
        )}

        {value.platform === UserContactPlatfrom.Email && (
          <CustomTextInput
            label="Email address"
            placeholder="Please enter your email address"
            value={value.value}
            onChangeText={handleContactChange}
            onFocus={() => setIsCheckingError(true)}
            onBlur={() => {
              const error = validateContact(value.platform, value.value);
              setContactError(error);
              setIsCheckingError(false);
            }}
            errorMessage={contactError}
          />
        )}
      </SafeAreaView>
    </CustomOverlay>
  );
}

export default AddContactOverlay;
