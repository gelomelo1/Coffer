import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import { useTranslation } from "react-i18next";
import { endpoints } from "@/src/const/endpoints";
import { ROUTES, pageParams } from "@/src/const/navigation_params";
import { useCollectionStore } from "@/src/hooks/collection_store";
import { useDeleteData } from "@/src/hooks/data_hooks";
import { useItemStore } from "@/src/hooks/item_store";
import { useResetNavigation } from "@/src/hooks/navigation";
import React from "react";

interface ItemDeleteFormProps {
  isDeleteItemConfirmVisible: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
}

function ItemDeleteForm({ isDeleteItemConfirmVisible }: ItemDeleteFormProps) {
  const { t } = useTranslation();
  const resetNavigate = useResetNavigation();
  const { item } = useItemStore();
  const { collectionType } = useCollectionStore();

  const { mutateAsync: deleteCollection, isPending: isDeletePending } =
    useDeleteData(endpoints.items, undefined, t("items:delete.done"));

  const handleOverlayClose = () => {
    if (isDeletePending) return;

    isDeleteItemConfirmVisible.set(false);
  };

  const handleDelete = async () => {
    try {
      await deleteCollection(item.id);
      handleOverlayClose();
      resetNavigate({
        pathname: ROUTES.MYCOLLECTION,
        params: pageParams.mycollection,
      });
    } catch (error) {
      handleOverlayClose();
      console.error("Failed to delete item:", error);
    }
  };

  return (
    <ConfirmDialog
      isVisible={isDeleteItemConfirmVisible.value}
      title={t("items:delete.title")}
      message={t("items:delete.message", { type: collectionType?.name ?? "" })}
      confirmLabel={t("items:delete.confirm")}
      destructive
      loading={isDeletePending}
      onConfirm={handleDelete}
      onCancel={handleOverlayClose}
    />
  );
}

export default ItemDeleteForm;
