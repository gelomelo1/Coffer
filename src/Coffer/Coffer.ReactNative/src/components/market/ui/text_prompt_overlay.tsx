import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomOverlay from "@/src/components/custom_ui/custom_overlay";
import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

/** Reusable "write a text and confirm" overlay: reply, report, dispute, cancel reason. */
function TextPromptOverlay({
  isVisible,
  onClose,
  title,
  explanation,
  placeholder,
  submitLabel,
  minLength = 0,
  maxLength,
  loading = false,
  submitDisabled = false,
  onSubmit,
  children,
}: {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  explanation?: string;
  placeholder?: string;
  submitLabel: string;
  minLength?: number;
  maxLength: number;
  loading?: boolean;
  /** Extra condition that keeps the submit button disabled (e.g. a required choice). */
  submitDisabled?: boolean;
  onSubmit: (text: string) => void;
  children?: React.ReactNode;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!isVisible) setText("");
  }, [isVisible]);

  const length = text.trim().length;
  const tooShort = length < minLength;

  return (
    <CustomOverlay
      isVisible={isVisible}
      onClose={onClose}
      overlayTitle={title}
      footerContent={
        <View style={{ width: "90%" }}>
          <CustomButton
            title={submitLabel}
            disabled={tooShort || length > maxLength || loading || submitDisabled}
            loading={loading}
            onPress={() => onSubmit(text.trim())}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }} keyboardShouldPersistTaps="handled">
        {explanation ? <CustomText>{explanation}</CustomText> : null}
        {children}
        <CustomTextInput
          placeholder={placeholder}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={maxLength}
          containerStyle={{ maxHeight: 220 }}
        />
        <CustomText style={{ fontSize: 13, color: tooShort ? "red" : undefined }}>
          {minLength > 0 ? `${length}/${minLength} characters minimum · ` : ""}
          {length}/{maxLength}
        </CustomText>
      </ScrollView>
    </CustomOverlay>
  );
}

export default TextPromptOverlay;
