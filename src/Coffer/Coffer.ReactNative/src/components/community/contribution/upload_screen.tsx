import { ConfirmDialog } from "@/src/components/custom_ui/confirm_dialog";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState, ErrorText } from "@/src/components/custom_ui/states";
import showToast from "@/src/components/custom_ui/toast";
import { useContribution, useUploadClassification, useUploadDetection } from "@/src/hooks/contribution";
import { colors, spacing, typography } from "@/src/theme/theme";
import { ContributionForm } from "@/src/types/entities/contribution";
import { apiErrorText } from "@/src/utils/api_error_text";
import { formState } from "@/src/utils/contribution_format";
import { pickImage } from "@/src/utils/data_access_utils";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePreventRemove } from "@react-navigation/native";
import { ImagePickerAsset } from "expo-image-picker";
import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { ExampleGallery, useHasExamples } from "./example_gallery";
import { Guidelines } from "./guidelines";
import { PhotoGrid } from "./photo_grid";

const seenKey = (form: ContributionForm) => `shape.guidelines.seen.${form}`;

/**
 * One upload form of a photo round. Detection: 1–20 photos at a time into the shared pool. Classification: a form of
 * 5–10 photos of the same item, sent whole; leaving with photos in it asks first.
 */
export function UploadScreen({ form }: { form: ContributionForm }) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { data, isLoading, isError, error, refetch } = useContribution();
  const detection = useUploadDetection();
  const classification = useUploadClassification();
  const upload = form === "detection" ? detection : classification;
  const [photos, setPhotos] = useState<ImagePickerAsset[]>([]);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [examples, setExamples] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  const hasExamples = useHasExamples(form);

  // The guidelines are open on the first visit of each form.
  useEffect(() => {
    AsyncStorage.getItem(seenKey(form)).then((seen) => {
      if (!seen) {
        setGuidelinesOpen(true);
        void AsyncStorage.setItem(seenKey(form), "1");
      }
    });
  }, [form]);

  const isForm = form === "classification";
  usePreventRemove(isForm && photos.length > 0 && !upload.isPending, ({ data: event }) => setLeaving(() => () => navigation.dispatch(event.action)));

  if (isLoading) return <Loading />;
  if (isError || !data) return <ErrorState message={apiErrorText(error)} onRetry={() => refetch()} />;
  const phase = data.enabled && data.phase?.kind === "photo" ? data.phase : null;
  if (!phase || !phase.limits) return <EmptyState icon="hourglass-empty" title={t("community:shape.countdown.ended")} />;

  const limits = phase.limits;
  const max = Math.min(isForm ? limits.formMax : limits.perUpload, Math.max(0, limits.dailyLeft));
  const state = formState(photos.length, isForm ? limits.formMin : 1, max || 1);
  const full = photos.length >= max;
  const resetsAt = new Date(limits.dailyResetsAt).toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" });

  const add = async (source: "camera" | "gallery") => {
    const room = max - photos.length;
    if (room <= 0) return;
    const result = await pickImage(source, source === "gallery" ? { allowsMultipleSelection: true, selectionLimit: room, orderedSelection: true } : undefined);
    if (result.status === "success") setPhotos((prev) => [...prev, ...result.assets].slice(0, max));
    else if (result.status === "permission_denied") showToast("error", t("market:photo.permissionTitle"), t("market:photo.permissionText"));
  };

  const send = () => {
    setSendError(null);
    upload.mutate(
      { phaseId: phase.id, assets: photos },
      {
        onSuccess: () => {
          showToast("success", isForm ? t("community:shape.classification.completed") : t("community:shape.detection.sent", { count: photos.length }));
          setPhotos([]);
        },
        onError: (e) => setSendError(apiErrorText(e)),
      },
    );
  };

  const mine = phase.mine ?? { detectionPhotos: 0, classificationForms: 0 };
  const canSend = isForm ? state !== "tooFew" : photos.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl * 2 }}>
        <Text style={[typography.headline, { color: colors.text }]} accessibilityRole="header">
          {t(`community:shape.${form}.title`)} · {phase.subject?.name ?? ""}
        </Text>
        <Text style={[typography.label, { color: colors.text }]}>
          {isForm ? t("community:shape.classification.mine", { count: mine.classificationForms }) : t("community:shape.detection.mine", { count: mine.detectionPhotos })}
        </Text>
        <Guidelines form={form} open={guidelinesOpen} onToggle={() => setGuidelinesOpen((o) => !o)} />
        {hasExamples ? <CustomButton title={t("community:shape.examples.open")} variant="outline" onPress={() => setExamples(true)} /> : null}

        {limits.dailyLeft === 0 ? (
          <Text style={[typography.label, { color: colors.danger }]}>{t("community:shape.limits.reached", { time: resetsAt })}</Text>
        ) : limits.dailyLeft < 40 ? (
          <Text style={[typography.label, { color: colors.text }]}>{t("community:shape.limits.left", { count: limits.dailyLeft })}</Text>
        ) : null}

        {isForm ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <MaterialCommunityIcons name="information-outline" size={20} color={colors.secondary} />
            <Text style={[typography.meta, { color: colors.text, flex: 1 }]}>{t("community:shape.classification.sameItem")}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <CustomButton
            title={t("community:shape.detection.camera")}
            variant="secondary"
            onPress={() => add("camera")}
            disabled={full || upload.isPending}
            icon={<MaterialCommunityIcons name="camera-outline" size={20} color={colors.onSecondary} />}
            containerStyle={{ flex: 1 }}
          />
          <CustomButton
            title={t("community:shape.detection.gallery")}
            variant="secondary"
            onPress={() => add("gallery")}
            disabled={full || upload.isPending}
            icon={<MaterialCommunityIcons name="image-multiple-outline" size={20} color={colors.onSecondary} />}
            containerStyle={{ flex: 1 }}
          />
        </View>

        {isForm ? (
          <Text style={[typography.label, { color: colors.text, fontVariant: ["tabular-nums"] }]} accessibilityLiveRegion="polite">
            {state === "full" ? t("community:shape.classification.full") : t("community:shape.classification.progress", { count: photos.length })}
          </Text>
        ) : photos.length === 0 ? (
          <Text style={[typography.meta, { color: colors.textMuted }]}>{t("community:shape.detection.empty", { count: limits.perUpload })}</Text>
        ) : full ? (
          <Text style={[typography.meta, { color: colors.text }]}>{t("community:shape.detection.full", { count: photos.length })}</Text>
        ) : null}

        <PhotoGrid photos={photos} slots={isForm ? limits.formMax : 0} onRemove={(i) => setPhotos((prev) => prev.filter((_, j) => j !== i))} />

        <ErrorText>{sendError}</ErrorText>
        <CustomButton
          title={isForm ? t("community:shape.classification.complete") : t("community:shape.detection.send", { count: photos.length })}
          onPress={send}
          disabled={!canSend || upload.isPending}
          loading={upload.isPending}
        />
      </ScrollView>

      <ExampleGallery form={form} isVisible={examples} onClose={() => setExamples(false)} />
      <ConfirmDialog
        isVisible={leaving !== null}
        title={t("community:shape.discard.title")}
        message={t("community:shape.discard.text")}
        confirmLabel={t("community:shape.discard.discard")}
        cancelLabel={t("community:shape.discard.keep")}
        destructive
        onConfirm={() => {
          const go = leaving;
          setLeaving(null);
          setPhotos([]);
          go?.();
        }}
        onCancel={() => setLeaving(null)}
      />
    </View>
  );
}
