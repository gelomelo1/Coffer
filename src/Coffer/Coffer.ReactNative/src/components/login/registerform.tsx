import { endpoints } from "@/src/const/endpoints";
import User from "@/src/types/entities/user";
import { getData } from "@/src/utils/backend_access";
import buildQuery from "@/src/utils/query_builder";
import { Filter } from "profanity-check";
import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Icon } from "react-native-elements";
import { customTheme } from "../../theme/theme";
import CustomButton from "../custom_ui/custom_button";
import CustomText from "../custom_ui/custom_text";
import CustomTextInput from "../custom_ui/custom_text_input";

interface RegisterFormProps {
  submitRegistration: (username: string) => void;
}

function RegisterForm({ submitRegistration }: RegisterFormProps) {
  const [userName, setUsername] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const languageFilter = new Filter();

  const handleChangeUsername = (newValue: string) => {
    setUsername(newValue);
    setIsSubmitDisabled(true);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    if (newValue === "") {
      setErrorMessage("");
      return;
    }

    debounceTimeout.current = setTimeout(async () => {
      setIsLoading(true);
      const usernameRegex = /^[a-zA-Z0-9._-]+$/;

      if (!usernameRegex.test(newValue)) {
        setErrorMessage("Allowed characters: letters, numbers, ., _, -");
        setIsLoading(false);
        return;
      }

      if (languageFilter.isProfane(newValue)) {
        setErrorMessage("Please avoid using inappropriate language");
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
        setErrorMessage("User already exists");
        setIsLoading(false);
        return;
      }

      setErrorMessage("");
      setIsSubmitDisabled(false);
      setIsLoading(false);
    }, 1000);
  };

  return (
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
      <CustomText>Please enter a username to finnish registration</CustomText>
      <CustomTextInput
        placeholder="Enter Username"
        label="Username"
        value={userName}
        onChangeText={(newValue) => handleChangeUsername(newValue)}
        errorMessage={errorMessage}
        rightIcon={
          isLoading ? (
            <ActivityIndicator size="small" color="dimgray" />
          ) : !!errorMessage ? (
            <Icon name="close" size={20} color="red" />
          ) : !isSubmitDisabled ? (
            <Icon name="check" size={20} color="green" />
          ) : undefined
        }
        containerStyle={{ width: "80%", marginBottom: 50 }}
      />
      <CustomButton
        title="Submit"
        disabled={isSubmitDisabled}
        onPress={() => submitRegistration(userName)}
        containerStyle={{ width: "80%" }}
      />
    </View>
  );
}

export default RegisterForm;
