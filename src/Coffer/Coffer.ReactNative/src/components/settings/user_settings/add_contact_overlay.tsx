import emptyUserContact from "@/src/const/empty_user_contact";
import { emailRegex, facebookRegex, languageFilter, phoneRegex } from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import { colors, fonts, spacing, typography } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { UserContact } from "@/src/types/entities/user_contact";
import UserContactPlatfrom from "@/src/types/helpers/user_contact_platform";
import { stringHasValue } from "@/src/utils/data_access_utils";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SectionCard } from "../../custom_ui/card";
import CustomButton from "../../custom_ui/custom_button";
import CustomOverlay from "../../custom_ui/custom_overlay";
import CustomTextInput from "../../custom_ui/custom_text_input";

interface AddContactOverlayProps {
  visible: boolean;
  onClose: () => void;
  user: User;
  selectedPlatform: UserContactPlatfrom;
  selectedContact?: UserContact;
  /** Receives the edited contact (new ones get the id "<platform>_new"); saved later with the whole card. */
  onSave: (contact: UserContact) => void;
}

function baseError(val: string) {
  if (!stringHasValue(val)) return stringResource.requiredError;
  if (languageFilter.isProfane(val)) return stringResource.profaneError;
  return undefined;
}

/** Validation of the main value per platform (phone number, e-mail address, Facebook display name). */
function valueError(platform: UserContactPlatfrom, val: string) {
  const base = baseError(val);
  if (base) return base;
  if (platform === UserContactPlatfrom.Phone && !phoneRegex.test(val)) return stringResource.notValidPhoneNumberError;
  if (platform === UserContactPlatfrom.Email && !emailRegex.test(val)) return stringResource.notValidEmailAddress;
  return undefined;
}

function facebookLinkError(val: string) {
  const base = baseError(val);
  if (base) return base;
  return facebookRegex.test(val) ? undefined : stringResource.notValidFacebookUsername;
}

const platformKey = (p: UserContactPlatfrom) => UserContactPlatfrom[p].toLowerCase();

/** Add or edit one marketplace contact. Errors show once a field was touched; Done stays disabled while invalid. */
function AddContactOverlay({ visible, onClose, user, selectedPlatform, selectedContact, onSave }: AddContactOverlayProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(emptyUserContact("", "", UserContactPlatfrom.Phone));
  const [touched, setTouched] = useState({ value: false, link: false });

  useEffect(() => {
    if (!visible) return;
    if (selectedContact) setValue(selectedContact);
    else {
      const existing = user.contacts.find((c) => c.platform === selectedPlatform);
      setValue(emptyUserContact(existing ? existing.id : `${selectedPlatform}_new`, user.id, selectedPlatform));
    }
    setTouched({ value: false, link: false });
  }, [visible, selectedContact, selectedPlatform, user]);

  const isFacebook = value.platform === UserContactPlatfrom.Facebook;
  const contactError = valueError(value.platform, value.value);
  const linkError = isFacebook ? facebookLinkError(value.link ?? "") : undefined;
  const key = platformKey(value.platform);

  return (
    <CustomOverlay
      isVisible={visible}
      onClose={onClose}
      overlayTitle={t(`settings:contacts.overlay.title.${key}`)}
      footerContent={
        <CustomButton
          title={t("common:actions.done")}
          disabled={!!contactError || !!linkError}
          onPress={() => {
            onSave({ ...value, value: value.value.trim(), link: value.link?.trim() });
            onClose();
          }}
        />
      }
    >
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t("settings:contacts.overlay.draftNote")}</Text>

        {isFacebook ? (
          <SectionCard title={t("settings:contacts.overlay.facebookHowTo")}>
            {(["step1", "step2", "step3", "step4", "step5"] as const).map((step) => (
              <View key={step} style={{ flexDirection: "row", gap: spacing.xs }}>
                <Text style={[typography.body, { color: colors.text }]}>•</Text>
                <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                  {t(`settings:contacts.overlay.facebookSteps.${step}`)}
                </Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        <CustomTextInput
          label={t(`settings:contacts.overlay.valueLabel.${key}`)}
          required
          placeholder={t(`settings:contacts.overlay.valuePlaceholder.${key}`)}
          value={value.value}
          onChangeText={(text) => setValue((prev) => ({ ...prev, value: text }))}
          onBlur={() => setTouched((x) => ({ ...x, value: true }))}
          errorMessage={touched.value ? contactError : undefined}
          keyboardType={value.platform === UserContactPlatfrom.Phone ? "phone-pad" : value.platform === UserContactPlatfrom.Email ? "email-address" : "default"}
          autoCapitalize={isFacebook ? "words" : "none"}
          autoComplete={value.platform === UserContactPlatfrom.Phone ? "tel" : value.platform === UserContactPlatfrom.Email ? "email" : "name"}
        />

        {isFacebook ? (
          <CustomTextInput
            label={t("settings:contacts.overlay.facebookUsername")}
            required
            placeholder={t("settings:contacts.overlay.facebookUsernamePlaceholder")}
            value={value.link}
            onChangeText={(text) => setValue((prev) => ({ ...prev, link: text }))}
            onBlur={() => setTouched((x) => ({ ...x, link: true }))}
            errorMessage={touched.link ? linkError : undefined}
            autoCapitalize="none"
            autoCorrect={false}
            inputStyle={{ fontFamily: fonts.regular }}
          />
        ) : null}
      </ScrollView>
    </CustomOverlay>
  );
}

export default AddContactOverlay;
