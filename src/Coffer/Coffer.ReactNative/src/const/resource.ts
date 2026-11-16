import i18n from "../i18n";

/** Validation messages, resolved through i18n each time they are read (so they follow the current language). */
export const stringResource = {
  get profaneError() {
    return i18n.t("validation:profane");
  },
  get textInputRegexError() {
    return i18n.t("validation:allowedCharacters");
  },
  get requiredError() {
    return i18n.t("validation:required");
  },
  get loginTextInputRegexError() {
    return i18n.t("validation:allowedUsernameCharacters");
  },
  get alreadyExistsError() {
    return i18n.t("validation:alreadyExists");
  },
  get notValidPhoneNumberError() {
    return i18n.t("validation:invalidPhone");
  },
  get notValidFacebookUsername() {
    return i18n.t("validation:invalidFacebook");
  },
  get notValidEmailAddress() {
    return i18n.t("validation:invalidEmail");
  },
  minCharacterRequiredError: (characterCount: number) => i18n.t("validation:minCharacters", { count: characterCount }),
};
