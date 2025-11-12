import { endpoints } from "@/src/const/endpoints";
import { languageFilter } from "@/src/const/filter";
import { stringResource } from "@/src/const/resource";
import User from "@/src/types/entities/user";
import { getData } from "@/src/utils/backend_access";
import buildQuery from "@/src/utils/query_builder";
import { useRef, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import CountryPicker, { Country } from "react-native-country-picker-modal";
import { Icon } from "react-native-elements";
import * as RNLocalize from "react-native-localize";
import { SafeAreaView } from "react-native-safe-area-context";
import { customTheme } from "../../theme/theme";
import CustomButton from "../custom_ui/custom_button";
import CustomText from "../custom_ui/custom_text";
import CustomTextInput from "../custom_ui/custom_text_input";

interface RegisterFormProps {
  submitRegistration: (username: string, country: string) => void;
}

function RegisterForm({ submitRegistration }: RegisterFormProps) {
  const [userName, setUsername] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const locales = RNLocalize.getLocales();
  const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);

  const handleChangeUsername = (newValue: string) => {
    setUsername(newValue);
    setIsSubmitDisabled(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

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

      const url = `${endpoints.users}${buildQuery({
        filters: [
          {
            filter: "Match",
            field: "name",
            value: newValue,
          },
        ],
      })}`;

      const userWithCurrentUsername = await getData<User>(url);

      if (userWithCurrentUsername.length !== 0) {
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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: customTheme.colors.background }}
    >
      <View
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          backgroundColor: customTheme.colors.background,
        }}
      >
        <CustomText>You have not have a registered account yet.</CustomText>
        <CustomText style={{ textAlign: "center" }}>
          Please enter a username and choose your country to finish registration
        </CustomText>
        <CustomTextInput
          placeholder="Enter Username"
          label="Username"
          value={userName}
          onChangeText={(newValue) => handleChangeUsername(newValue)}
          errorMessage={errorMessage}
          rightIcon={
            isLoading ? (
              <ActivityIndicator
                size="small"
                color={customTheme.colors.accent}
              />
            ) : !!errorMessage ? (
              <Icon name="close" size={20} color="red" />
            ) : !isSubmitDisabled ? (
              <Icon name="check" size={20} color="green" />
            ) : undefined
          }
          containerStyle={{ width: "80%", marginBottom: 20 }}
        />
        <TouchableOpacity
          style={{ width: "80%", marginBottom: 50 }}
          onPress={() => setIsCountryPickerVisible(true)}
        >
          <CustomTextInput
            placeholder="Select your country"
            label="Country"
            value={country ? country.name.toString() : ""}
            editable={false}
          />
        </TouchableOpacity>
        <CustomButton
          title="Submit"
          disabled={isSubmitDisabled || country === null}
          onPress={() =>
            submitRegistration(userName, country?.cca2.toString()!)
          }
          containerStyle={{ width: "80%", alignSelf: "center" }}
        />
      </View>
      <CountryPicker
        countryCode={
          country?.cca2 ?? (locales?.[0]?.countryCode as any) ?? "EN"
        }
        visible={isCountryPickerVisible}
        onClose={() => setIsCountryPickerVisible(false)}
        onSelect={(country) => setCountry(country)}
        renderFlagButton={() => null}
        withCloseButton={false}
        withFilter={true}
        withFlag={true}
        filterProps={{ style: { marginTop: 100 } }}
      />
    </SafeAreaView>
  );
}

export default RegisterForm;
