import { colors, typography } from "@/src/theme/theme";
import React from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import CustomButton from "./custom_button";
import Dialog from "./dialog";

interface ConfirmDialogProps {
  isVisible: boolean;
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation before an action; destructive confirms are red and placed under the safe choice. */
export function ConfirmDialog({
  isVisible,
  title,
  message,
  children,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      visible={isVisible}
      onClose={onCancel}
      dismissable={!loading}
      title={title}
      actions={
        <>
          <CustomButton title={cancelLabel ?? t("common:actions.cancel")} variant="outline" onPress={onCancel} disabled={loading} />
          <CustomButton
            title={confirmLabel}
            variant={destructive ? "danger" : "primary"}
            onPress={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          />
        </>
      }
    >
      {message ? <Text style={[typography.body, { color: colors.text }]}>{message}</Text> : null}
      {children}
    </Dialog>
  );
}

export default ConfirmDialog;
