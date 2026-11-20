import { SectionCard } from "@/src/components/custom_ui/card";
import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import CustomButton from "@/src/components/custom_ui/custom_button";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { Loading } from "@/src/components/custom_ui/loading";
import { ErrorState } from "@/src/components/custom_ui/states";
import showToast from "@/src/components/custom_ui/toast";
import { Screen } from "@/src/components/custom_ui/screen";
import BlockingTrades from "@/src/components/settings/delete_account/blocking_trades";
import { querykeys } from "@/src/const/querykeys";
import { useUserStore } from "@/src/hooks/user_store";
import { colors, typography } from "@/src/theme/theme";
import { signOutDeletedAccount } from "@/src/utils/account_deleted";
import { apiErrorText } from "@/src/utils/api_error_text";
import { apiErrorMessage, marketApi } from "@/src/utils/market_api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

/**
 * Delete account: what goes and what stays, the open trades that block it (cancel or wait), then type the
 * username and confirm. Afterwards the app signs out.
 */
function DeleteAccount() {
  const { t } = useTranslation();
  const { user } = useUserStore();
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);

  const status = useQuery({ queryKey: [querykeys.accountDeletion], queryFn: marketApi.accountDeletion });
  const remove = useMutation({
    mutationFn: marketApi.deleteAccount,
    onSuccess: async () => {
      setConfirming(false);
      showToast("success", t("settings:deleteAccount.done"));
      await signOutDeletedAccount();
    },
    onError: (error) => {
      setConfirming(false);
      showToast("error", apiErrorMessage(error));
      status.refetch();
    },
  });

  const name = user?.name ?? "";
  const data = status.data;
  const blocking = data?.blockingDeals ?? [];
  const canDelete = !!data?.canDelete && name.length > 0 && typed.trim() === name;

  return (
    <Screen scroll>
      <SectionCard title={t("settings:deleteAccount.goesTitle")}>
        <Text style={[typography.body, { color: colors.text }]}>{t("settings:deleteAccount.goes")}</Text>
      </SectionCard>
      <SectionCard title={t("settings:deleteAccount.staysTitle")}>
        <Text style={[typography.body, { color: colors.text }]}>{t("settings:deleteAccount.stays")}</Text>
      </SectionCard>

      {status.isLoading ? (
        <Loading />
      ) : status.isError ? (
        <ErrorState message={apiErrorText(status.error)} onRetry={() => status.refetch()} />
      ) : blocking.length > 0 ? (
        <BlockingTrades deals={blocking} onChanged={() => status.refetch()} />
      ) : null}

      <Text style={[typography.body, { color: colors.text }]}>{t("settings:deleteAccount.final")}</Text>
      <CustomTextInput
        label={t("settings:deleteAccount.typeName", { name })}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!!data?.canDelete}
      />
      <CustomButton title={t("settings:deleteAccount.button")} variant="danger" disabled={!canDelete} onPress={() => setConfirming(true)} />

      <ConfirmDialog
        isVisible={confirming}
        title={t("settings:deleteAccount.confirmTitle")}
        message={t("settings:deleteAccount.confirmText")}
        confirmLabel={t("settings:deleteAccount.button")}
        destructive
        loading={remove.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => remove.mutate()}
      />
    </Screen>
  );
}

export default DeleteAccount;
