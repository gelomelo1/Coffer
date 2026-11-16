import { endpoints } from "@/src/const/endpoints";
import { languageFilter } from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import { getData } from "@/src/utils/backend_access";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Country } from "react-native-country-picker-modal";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, typography } from "../../theme/theme";
import CountryField from "../custom_ui/country_field";
import CustomButton from "../custom_ui/custom_button";
import CustomTextInput from "../custom_ui/custom_text_input";
import NameCheckIcon from "../custom_ui/name_check_icon";

interface RegisterFormProps {
  submitRegistration: (username: string, country: string) => void;
  onCancel?: () => void;
}

function RegisterForm({ submitRegistration, onCancel }: RegisterFormProps) {
  const { t } = useTranslation();
  const [userName, setUsername] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangeUsername = (newValue: string) => {
    setUsername(newValue);
    setIsSubmitDisabled(true);

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    if (newValue === "") {
      setErrorMessage(stringResource.requiredError);
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      setIsLoading(true);
      const usernameRegex = /^[a-zA-Z0-9._-]+$/;

      if (!usernameRegex.test(newValue)) {
        setErrorMessage(stringResource.loginTextInputRegexError);
        setIsLoading(false);
        return;
      }

      if (languageFilter.isProfane(newValue)) {
        setErrorMessage(stringResource.profaneError);
        setIsLoading(false);
        return;
      }

      const userWithCurrentUsername = await getData<boolean>(`${endpoints.userExists}/${newValue}`);

      if (userWithCurrentUsername) {
        setErrorMessage(stringResource.alreadyExistsError);
        setIsLoading(false);
        return;
      }

      setErrorMessage("");
      setIsSubmitDisabled(false);
      setIsLoading(false);
    }, 1000);
  };

  return (
    // Rendered inside a Modal (outside the app's providers on Android), so it provides its own insets.
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ gap: spacing.xs }}>
              <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
                {t("auth:register.title")}
              </Text>
              <Text style={[typography.body, { color: colors.text }]}>{t("auth:register.intro")}</Text>
            </View>
            <CustomTextInput
              label={t("auth:register.username")}
              placeholder={t("auth:register.usernamePlaceholder")}
              helperText={t("auth:register.usernameHelper")}
              value={userName}
              onChangeText={handleChangeUsername}
              errorMessage={errorMessage}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              maxLength={40}
              required
              rightIcon={<NameCheckIcon checking={isLoading} error={!!errorMessage} ok={!isSubmitDisabled} />}
            />
            <CountryField label={t("auth:register.country")} value={country} onSelect={setCountry} />
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <CustomButton
                title={t("auth:register.submit")}
                disabled={isSubmitDisabled || country === null}
                onPress={() => {
                  // Optional chaining: the React Compiler reads closure dependencies during render.
                  if (country?.cca2) submitRegistration(userName, String(country?.cca2));
                }}
              />
              {onCancel ? <CustomButton title={t("auth:register.cancel")} variant="ghost" onPress={onCancel} /> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default RegisterForm;
