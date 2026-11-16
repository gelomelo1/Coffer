import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { useUserStore } from "@/src/hooks/user_store";
import { pressableShadowStyle } from "@/src/theme/pressable";
import { borders, colors, spacing, typography } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import PickerField from "../custom_ui/picker_field";
import SheetModal from "../custom_ui/sheet_modal";
import { Loading } from "../custom_ui/loading";
import ItemRegisterCollectionSectionList from "./item_register_collection_sectionlist";

interface ItemRegisterCollectionSelectOverlayProps {
  isItemRegisterCollectionSelectOverlayOpen: {
    value: boolean;
    set: React.Dispatch<React.SetStateAction<boolean>>;
  };
  selectedCollection: {
    value: Collection | null;
    set: React.Dispatch<React.SetStateAction<Collection | null>>;
  };

  onGalleryPick: () => void;
  onPhotoPick: () => void;
}

function ItemRegisterCollectionSelectOverlay({
  isItemRegisterCollectionSelectOverlayOpen,
  selectedCollection,
  onGalleryPick,
  onPhotoPick,
}: ItemRegisterCollectionSelectOverlayProps) {
  const { t } = useTranslation();
  const { user } = useUserStore();

  const { data: collections = [], isFetching: isCollectionsFetching } =
    useGetData<Collection>(endpoints.collections, querykeys.collectionsData, {
      filters: [
        {
          filter: "Match",
          field: "userId",
          value: user!.id,
        },
      ],
    });

  const [
    isItemRegisterCollectionSectionListOverlayOpen,
    setIsItemRegisterCollectionSectionListOverlayOpen,
  ] = useState(false);

  const handleClose = () => {
    selectedCollection.set(null);
    isItemRegisterCollectionSelectOverlayOpen.set(false);
  };

  const handleOpenSectionList = () => {
    setIsItemRegisterCollectionSectionListOverlayOpen(true);
  };

  const isDisabled = !selectedCollection.value;

  const sourceTile = (icon: React.ReactNode, label: string, onPress: () => void) => (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        {
          flex: 1,
          minWidth: 130,
          minHeight: 128,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          padding: spacing.md,
          backgroundColor: colors.primary,
          borderWidth: borders.width,
          borderColor: colors.primary,
          opacity: isDisabled ? 0.4 : 1,
        },
        pressableShadowStyle(pressed, isDisabled),
      ]}
    >
      {icon}
      <Text style={[typography.bodyStrong, { color: colors.onPrimary, textAlign: "center" }]}>{label}</Text>
    </Pressable>
  );

  const step = (n: number, text: string) => (
    <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
      <View style={{ width: 28, height: 28, backgroundColor: colors.secondary, borderWidth: borders.width, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
        <Text style={[typography.label, { color: colors.onSecondary }]}>{n}</Text>
      </View>
      <Text style={[typography.bodyStrong, { color: colors.text, flex: 1, paddingTop: 2 }]}>{text}</Text>
    </View>
  );

  return (
    <>
      <SheetModal visible={isItemRegisterCollectionSelectOverlayOpen.value} onClose={handleClose} title={t("items:register.title")}>
        {isCollectionsFetching ? (
          <Loading />
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}>
            <Text style={[typography.meta, { color: colors.text }]}>{t("items:register.intro")}</Text>
            {step(1, t("items:register.step1"))}
            <PickerField
              value={selectedCollection.value?.name ?? null}
              placeholder={t("items:register.chooseCollection")}
              icon="inventory-2"
              onPress={handleOpenSectionList}
            />
            {step(2, t("items:register.step2"))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              {sourceTile(<FontAwesome name="camera" size={40} color={colors.secondary} />, t("items:register.takePhoto"), onPhotoPick)}
              {sourceTile(<MaterialIcons name="image" size={44} color={colors.secondary} />, t("items:register.fromGallery"), onGalleryPick)}
            </View>
            {isDisabled ? <Text style={[typography.caption, { color: colors.textMuted }]}>{t("items:register.chooseFirst")}</Text> : null}
          </ScrollView>
        )}
      </SheetModal>
      <ItemRegisterCollectionSectionList
        isItemRegisterCollectionSectionListOverlayOpen={{
          value: isItemRegisterCollectionSectionListOverlayOpen,
          set: setIsItemRegisterCollectionSectionListOverlayOpen,
        }}
        selectedCollection={{ value: selectedCollection.value, set: selectedCollection.set }}
        collections={collections}
      />
    </>
  );
}

export default ItemRegisterCollectionSelectOverlay;
