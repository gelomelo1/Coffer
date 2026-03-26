export const stringResource = {
  profaneError: "Please avoid using inappropriate language",
  textInputRegexError: "Allowed characters: letters, numbers, space, ., -",
  requiredError: "Required field",
  loginTextInputRegexError: "Allowed characters: letters, numbers, ., _, -",
  alreadyExistsError: "Already exists",
  notValidPhoneNumberError: "Not a valid phone number",
  notValidFacebookUsername: "Not a valid Facebook username",
  notValidEmailAddress: "Not a valid email address",
  minCharacterRequiredError: (characterCount: number) =>
    `Minimum ${characterCount} character required`,
};
