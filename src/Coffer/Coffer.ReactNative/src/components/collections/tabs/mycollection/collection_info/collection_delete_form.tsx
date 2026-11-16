import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import { endpoints } from "@/src/const/endpoints";
import { pageParams, ROUTES } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useResetNavigation } from "@/src/hooks/navigation";
import React from "react";
import { useTranslation } from "react-i18next";

interface CollectionDeleteFormProps {
  isDeleteCollectionConfirmVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

/** Destructive confirmation before deleting the current collection; returns to the Collections tab. */
function CollectionDeleteForm({ isDeleteCollectionConfirmVisible }: CollectionDeleteFormProps) {
  const { t } = useTranslation();
  const resetNavigate = useResetNavigation();
  const { collection } = useCollectionStore();

  const { mutateAsync: deleteCollection, isPending } = useDeleteData(endpoints.collections, undefined, t("collections:delete.done"));

  const close = () => {
    if (isPending) return;
    isDeleteCollectionConfirmVisible.set(false);
  };

  const handleDelete = async () => {
    if (!collection) return;
    try {
      await deleteCollection(collection.id);
      isDeleteCollectionConfirmVisible.set(false);
      resetNavigate({ pathname: ROUTES.TABS.COLLECTIONS, params: pageParams.collections });
    } catch (error) {
      isDeleteCollectionConfirmVisible.set(false);
      console.error("Failed to delete collection:", error);
    }
  };

  return (
    <ConfirmDialog
      isVisible={isDeleteCollectionConfirmVisible.value}
      title={t("collections:delete.title")}
      message={t("collections:delete.message", { name: collection?.name ?? "" })}
      confirmLabel={t("collections:delete.confirm")}
      destructive
      loading={isPending}
      onConfirm={handleDelete}
      onCancel={close}
    />
  );
}

export default CollectionDeleteForm;
