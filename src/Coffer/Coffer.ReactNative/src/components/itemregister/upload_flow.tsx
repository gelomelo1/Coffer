import { useInvalidatePending } from "@/src/hooks/pending";
import { openReview } from "@/src/hooks/review_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { Collection } from "@/src/types/entities/collection";
import { pickImage } from "@/src/utils/data_access_utils";
import { pendingApi } from "@/src/utils/pending_api";
import { resizeForUpload } from "@/src/utils/resize_photo";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ImagePickerAsset } from "expo-image-picker";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ConfirmDialog } from "../custom_ui/confirm_dialog";
import CustomButton from "../custom_ui/custom_button";
import CustomOverlayMessage from "../custom_ui/custom_overlay_message";
import ItemRegisterImagePickerOverlay from "./item_register_image_picker_overlay";

/** Most photos per upload: keeps the AI checks short. More can follow in the next upload. */
export const MAX_PHOTOS = 10;

type Status = "waiting" | "checking" | "done" | "failed";
interface Photo {
  key: string;
  asset: ImagePickerAsset;
  status: Status;
  found: number;
}

/**
 * Adding items: one or more photos (gallery multi-select, or the camera with "Take another") are checked one after
 * another; every cap found joins the collection's waiting-for-review list, then the review screen opens on it.
 * A photo that fails can be retried without losing the others. Returns the `start` function and the UI to render.
 */
export function useUploadFlow() {
  const { t } = useTranslation();
  const invalidate = useInvalidatePending();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [opening, setOpening] = useState<"Gallery" | "Camera" | null>(null);
  const [permissionDenied, setPermissionDenied] = useState<"Gallery" | "Camera" | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [askAnother, setAskAnother] = useState(false);
  const [running, setRunning] = useState(false);
  const shots = useRef<ImagePickerAsset[]>([]);

  const update = (key: string, patch: Partial<Photo>) => setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const check = async (target: Collection, photo: Photo) => {
    update(photo.key, { status: "checking" });
    try {
      const resized = await resizeForUpload(photo.asset);
      const result = await pendingApi.checkImage(target.id, resized);
      update(photo.key, { status: "done", found: result.created.length });
    } catch {
      update(photo.key, { status: "failed" });
    }
  };

  /** Checks the photos one by one (never in parallel: one AI check at a time). */
  const run = async (target: Collection, list: Photo[]) => {
    setRunning(true);
    for (const photo of list) await check(target, photo);
    setRunning(false);
    invalidate();
  };

  const begin = (target: Collection, assets: ImagePickerAsset[]) => {
    const list = assets.slice(0, MAX_PHOTOS).map((asset, i) => ({ key: `${Date.now()}-${i}`, asset, status: "waiting" as Status, found: 0 }));
    setPhotos(list);
    void run(target, list);
  };

  const shoot = async (target: Collection) => {
    setOpening("Camera");
    const result = await pickImage("camera");
    setOpening(null);
    if (result.status === "permission_denied") return setPermissionDenied("Camera");
    if (result.status === "success") {
      shots.current = [...shots.current, ...result.assets];
      if (shots.current.length < MAX_PHOTOS) return setAskAnother(true);
    }
    if (shots.current.length > 0) begin(target, shots.current);
  };

  /** Starts adding items to a collection from the camera or the gallery. */
  const start = async (target: Collection, source: "camera" | "gallery") => {
    setCollection(target);
    setPhotos([]);
    shots.current = [];
    if (source === "camera") return shoot(target);
    setOpening("Gallery");
    const result = await pickImage("gallery", { allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS, orderedSelection: true });
    setOpening(null);
    if (result.status === "permission_denied") return setPermissionDenied("Gallery");
    if (result.status === "success" && result.assets.length > 0) begin(target, result.assets);
  };

  const close = () => {
    setPhotos([]);
    setCollection(null);
  };

  const review = () => {
    const target = collection!;
    close();
    openReview({ collectionId: target.id, collectionName: target.name, collectionTypeId: target.collectionTypeId });
  };

  const totalFound = photos.reduce((sum, p) => sum + p.found, 0);
  const finished = photos.length > 0 && !running;
  const checkingIndex = photos.findIndex((p) => p.status === "checking");
  const emptyPhotos = photos.filter((p) => p.status === "done" && p.found === 0).length;

  const statusLine = (p: Photo) =>
    p.status === "waiting"
      ? t("items:upload.waiting")
      : p.status === "checking"
        ? t("items:upload.checking")
        : p.status === "failed"
          ? t("items:upload.failed")
          : p.found === 0
            ? t("items:upload.noneFound")
            : t("items:upload.found", { count: p.found });

  const node = (
    <>
      <ItemRegisterImagePickerOverlay isImagePickerLoading={opening} />
      <CustomOverlayMessage
        isVisible={permissionDenied !== null}
        onClose={() => setPermissionDenied(null)}
        overlayTitle={permissionDenied === "Gallery" ? t("items:permissions.galleryTitle") : t("items:permissions.cameraTitle")}
        message={permissionDenied === "Gallery" ? t("items:permissions.galleryText") : t("items:permissions.cameraText")}
      />
      <ConfirmDialog
        isVisible={askAnother}
        title={t("items:upload.anotherTitle", { count: shots.current.length })}
        message={t("items:upload.anotherText")}
        confirmLabel={t("items:upload.takeAnother")}
        cancelLabel={t("items:upload.done", { count: shots.current.length })}
        onConfirm={() => {
          setAskAnother(false);
          void shoot(collection!);
        }}
        onCancel={() => {
          setAskAnother(false);
          begin(collection!, shots.current);
        }}
      />
      <Modal visible={photos.length > 0} animationType="slide" onRequestClose={() => (finished ? close() : undefined)} statusBarTranslucent navigationBarTranslucent>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ padding: spacing.md, borderBottomWidth: borders.width, borderBottomColor: colors.border, gap: spacing.xs }}>
              <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
                {finished ? t("items:upload.finishedTitle", { count: totalFound }) : t("items:upload.progressTitle", { current: checkingIndex + 1, total: photos.length })}
              </Text>
              <Text style={[typography.meta, { color: colors.textMuted }]} accessibilityLiveRegion="polite">
                {finished
                  ? emptyPhotos > 0
                    ? t("items:upload.finishedEmpty", { count: emptyPhotos })
                    : t("items:upload.finishedText")
                  : t("items:upload.progressText")}
              </Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
              {photos.map((p, i) => (
                <View
                  key={p.key}
                  style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: borders.width, borderColor: colors.border, padding: spacing.sm, backgroundColor: colors.surface }}
                  accessible
                  accessibilityLabel={`${t("items:upload.photo", { number: i + 1 })}, ${statusLine(p)}`}
                >
                  <Image source={{ uri: p.asset.uri }} style={{ width: 56, height: 56, borderWidth: borders.width, borderColor: colors.border }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.bodyStrong, { color: colors.text }]}>{t("items:upload.photo", { number: i + 1 })}</Text>
                    <Text style={[typography.meta, { color: p.status === "failed" ? colors.danger : colors.textMuted }]}>{statusLine(p)}</Text>
                  </View>
                  {p.status === "checking" ? (
                    <ActivityIndicator color={colors.text} />
                  ) : p.status === "done" ? (
                    <MaterialIcons name="check-circle" size={sizes.iconMd} color={colors.success} />
                  ) : p.status === "failed" ? (
                    <CustomButton
                      title={t("items:upload.retry")}
                      size="sm"
                      variant="outline"
                      disabled={running}
                      onPress={() => {
                        const target = collection!;
                        setRunning(true);
                        void check(target, p).then(() => {
                          setRunning(false);
                          invalidate();
                        });
                      }}
                    />
                  ) : (
                    <MaterialIcons name="schedule" size={sizes.iconMd} color={colors.textMuted} />
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderTopWidth: borders.width, borderTopColor: colors.border }}>
              <CustomButton title={t("items:upload.later")} variant="outline" onPress={close} disabled={!finished} containerStyle={{ flex: 1 }} />
              <CustomButton
                title={t("items:upload.review", { count: totalFound })}
                onPress={review}
                disabled={!finished || totalFound === 0}
                containerStyle={{ flex: 1 }}
              />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );

  return { start, node };
}
