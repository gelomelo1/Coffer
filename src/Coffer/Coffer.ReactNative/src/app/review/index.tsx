import ActionBar from "@/src/components/review/action_bar";
import MatchChips from "@/src/components/review/match_chips";
import PhotoCompare from "@/src/components/review/photo_compare";
import ReviewFields, { ReviewDraft } from "@/src/components/review/review_fields";
import ReviewHelpSheet, { useReviewHelp } from "@/src/components/review/review_help_sheet";
import UndoBar from "@/src/components/review/undo_bar";
import CustomButton from "@/src/components/custom_ui/custom_button";
import { Loading } from "@/src/components/custom_ui/loading";
import { EmptyState, ErrorState } from "@/src/components/custom_ui/states";
import showToast from "@/src/components/custom_ui/toast";
import { endpoints } from "@/src/const/endpoints";
import { querykeys } from "@/src/const/querykeys";
import { useGetData } from "@/src/hooks/data_hooks";
import { useKeyboardOverlapAtScreenBottom } from "@/src/hooks/keyboard_toolbar";
import { useInvalidatePending, usePendingList } from "@/src/hooks/pending";
import { useReviewStore } from "@/src/hooks/review_store";
import i18n from "@/src/i18n";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import Attribute from "@/src/types/entities/attribute";
import { ItemProvided } from "@/src/types/entities/item";
import { AddPendingInput, PendingItem } from "@/src/types/entities/pending";
import { AttributeDataTypes } from "@/src/types/helpers/attribute_data";
import { apiErrorText } from "@/src/utils/api_error_text";
import { getDefaultAttributeValue, getItemPrimaryAttributeValue } from "@/src/utils/data_access_utils";
import { HeldActionQueue } from "@/src/utils/held_action";
import { pendingApi } from "@/src/utils/pending_api";
import { missingRequired } from "@/src/utils/required_fields";
import { daysUntil, remainingCount } from "@/src/utils/review_progress";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const UNDO_MS = 5000;
/** Items removed within this time get a note (matches the backend's 3-day warning). */
const EXPIRY_WARNING_MS = 3 * 24 * 60 * 60 * 1000;

type Kind = "add" | "delete" | "skip";
interface CapState {
  selected: number;
  quantity: number;
  draft: ReviewDraft;
}

const nameOf = (item: ItemProvided) => getItemPrimaryAttributeValue(item.itemAttributes)?.value?.toLocaleString(i18n.language) ?? "";

/** Default form for a new item: every attribute at its default (text empty, so required text fields start missing). */
function defaultDraft(attributes: Attribute[]): ReviewDraft {
  const values: ReviewDraft["values"] = {};
  for (const a of attributes) values[a.id] = getDefaultAttributeValue(a) as string | number | boolean;
  return { values, tags: [], privateNote: "", description: "" };
}

function toInput(cap: PendingItem, state: CapState, attributes: Attribute[]): AddPendingInput {
  const match = state.selected >= 0 ? cap.similars[state.selected] : null;
  if (match) return { matchItemId: match.id, quantity: state.quantity };
  const { draft } = state;
  return {
    quantity: state.quantity,
    item: {
      collectionId: cap.collectionId,
      quantity: state.quantity,
      image: "",
      privateNote: draft.privateNote.trim() || null,
      description: draft.description.trim() || null,
      itemTags: draft.tags.map((x) => ({ tag: x.tag })),
      itemAttributes: attributes.map((a) => {
        const v = draft.values[a.id];
        switch (a.dataType) {
          case AttributeDataTypes.Number:
            return { attributeId: a.id, valueNumber: typeof v === "number" ? v : null };
          case AttributeDataTypes.Boolean:
            return { attributeId: a.id, valueBoolean: v === true };
          case AttributeDataTypes.Date:
            return { attributeId: a.id, valueDate: typeof v === "string" && v ? v : null };
          default:
            return { attributeId: a.id, valueString: typeof v === "string" ? v.trim() : "" };
        }
      }),
    },
  };
}

/**
 * Waiting for review: one cap at a time, newest first. Add / Skip / Skip & delete are always on screen; each is held
 * for 5 seconds with an Undo before it is sent, and leaving the screen sends whatever is held. Closing is always safe:
 * whatever wasn't decided stays on the list.
 */
function Review() {
  const { t } = useTranslation();
  const target = useReviewStore((s) => s.target);
  const insets = useSafeAreaInsets();
  const keyboardOverlap = useKeyboardOverlapAtScreenBottom();
  const invalidate = useInvalidatePending();
  const help = useReviewHelp();

  const list = usePendingList(target?.collectionId ?? null);
  const typeId = target?.collectionTypeId ?? 0;
  const { data: attributes = [], isFetching: attributesLoading } = useGetData<Attribute>(endpoints.attributes, `${querykeys.attributesData}${typeId}`, {
    filters: [{ filter: "==", field: "collectionTypeId", value: typeId }],
  });

  // Caps acted on (held or sent) leave the walk; Skip only moves on.
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = useMemo(() => list.items.filter((i) => !hidden.has(i.id)), [list.items, hidden]);
  const [pos, setPos] = useState(0);
  const current: PendingItem | undefined = visible[pos];

  // Per-cap choices, kept so an Undo brings back exactly what was entered.
  const saved = useRef(new Map<string, CapState>());
  const [cap, setCap] = useState<CapState | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef(new Map<number, number>());
  const formTop = useRef(0);

  const currentId = current?.id;
  useEffect(() => {
    if (!current || attributesLoading) return;
    const restored = saved.current.get(current.id);
    setCap(
      restored ?? {
        selected: current.state === "found" && current.similars.length > 0 ? 0 : -1,
        quantity: Math.max(1, current.quantity),
        draft: defaultDraft(attributes),
      },
    );
    setFieldErrors({});
    setFormVersion((v) => v + 1);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, attributesLoading]);

  // Fetch the next page before the walk reaches its end.
  const hasNextPage = list.hasNextPage;
  const loadMore = list.loadMore;
  useEffect(() => {
    if (pos >= visible.length - 2 && hasNextPage) loadMore();
  }, [pos, visible.length, hasNextPage, loadMore]);

  // --- held actions (5-second Undo) ---
  const meta = useRef(new Map<string, { kind: Kind; pendingId: string; pos: number }>());
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const clearUndo = (id: string) => setUndo((u) => (u?.id === id ? null : u));
  const queue = useRef<HeldActionQueue | null>(null);
  if (!queue.current) {
    queue.current = new HeldActionQueue({
      delayMs: UNDO_MS,
      onSent: (a) => {
        clearUndo(a.id);
        if (meta.current.get(a.id)?.kind !== "skip") invalidate();
        meta.current.delete(a.id);
      },
      onFailed: (a, error) => {
        clearUndo(a.id);
        const m = meta.current.get(a.id);
        meta.current.delete(a.id);
        if (!m) return;
        setHidden((prev) => {
          const next = new Set(prev);
          next.delete(m.pendingId);
          return next;
        });
        showToast("error", t("items:review.sendFailed", { what: a.label }), apiErrorText(error));
      },
    });
  }

  // Leaving (close, back, app to background) sends what is held right away.
  useEffect(() => {
    const q = queue.current!;
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") void q.flush();
    });
    return () => {
      sub.remove();
      void q.flush();
    };
  }, []);

  const hold = (kind: Kind, label: string, send: () => Promise<void>) => {
    if (!current || !cap) return;
    const id = `${kind}-${current.id}-${Date.now()}`;
    saved.current.set(current.id, cap);
    meta.current.set(id, { kind, pendingId: current.id, pos });
    queue.current!.hold({ id, label, send });
    setUndo({ id, label });
    if (kind === "skip") setPos((p) => p + 1);
    else setHidden((prev) => new Set(prev).add(current.id));
  };

  const onUndo = () => {
    const action = queue.current!.undo();
    if (!action) return;
    setUndo(null);
    const m = meta.current.get(action.id);
    meta.current.delete(action.id);
    if (!m) return;
    if (m.kind !== "skip")
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(m.pendingId);
        return next;
      });
    setPos(m.pos);
  };

  const close = async () => {
    await queue.current!.flush();
    if (router.canGoBack()) router.back();
  };

  if (!target) return <ErrorState message={t("items:review.noCollection")} />;

  const match = current && cap && cap.selected >= 0 ? current.similars[cap.selected] ?? null : null;
  const matchNames = current ? current.similars.map(nameOf) : [];
  const missing = !current || !cap || match ? [] : missingRequired(attributes, cap.draft.values).map((a) => ({ id: a.id, name: a.name }));
  const blockedText = !match && Object.values(fieldErrors).some(Boolean) ? t("items:review.fixErrors") : null;
  const primary = attributes.find((a) => a.primary);
  const newName = cap && primary ? String(cap.draft.values[primary.id] ?? "").trim() : "";
  const itemName = match ? (matchNames[cap!.selected] || t("items:review.newItem")) : newName || t("items:review.newItem");
  const remaining = remainingCount(list.total, list.items.map((i) => i.id), hidden);
  const bottomInset = keyboardOverlap ?? insets.bottom;

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs, borderBottomWidth: borders.width, borderBottomColor: colors.border, backgroundColor: colors.primary }}>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t("items:review.close")} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name="close" size={sizes.iconMd} color={colors.onPrimary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.onPrimary }]} numberOfLines={1}>
          {t("items:review.title")}
        </Text>
        <Text style={[typography.meta, { color: colors.onPrimary }]} numberOfLines={1}>
          {target.collectionName}
        </Text>
      </View>
      {current ? (
        <Text style={[typography.label, { color: colors.onPrimary }]} accessibilityLabel={t("items:review.progressA11y", { current: pos + 1, total: remaining })}>
          {pos + 1} / {remaining}
        </Text>
      ) : null}
      <Pressable onPress={help.show} accessibilityRole="button" accessibilityLabel={t("items:review.helpTitle")} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name="info-outline" size={sizes.iconMd} color={colors.onPrimary} />
      </Pressable>
    </View>
  );

  const body = () => {
    if (list.isLoading || attributesLoading) return <Loading label={t("items:review.loading")} />;
    if (list.isError) return <ErrorState message={apiErrorText(list.error)} onRetry={() => list.refetch()} />;
    if (visible.length === 0 && !hasNextPage)
      return (
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.md }}>
          <EmptyState icon="task-alt" title={t("items:review.caughtUpTitle")} text={t("items:review.caughtUpText")} />
          <CustomButton title={t("items:review.close")} onPress={close} />
        </View>
      );
    if (!current)
      return (
        <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.md }}>
          <EmptyState icon="replay" title={t("items:review.endTitle")} text={t("items:review.endText", { count: visible.length })} />
          <CustomButton title={t("items:review.startOver")} onPress={() => setPos(0)} />
          <CustomButton title={t("items:review.close")} variant="outline" onPress={close} />
        </View>
      );
    if (!cap) return <Loading />;
    return (
      <>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          {new Date(current.expiresAt).getTime() - Date.now() <= EXPIRY_WARNING_MS ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, borderWidth: borders.width, borderColor: colors.danger, padding: spacing.sm }}>
              <MaterialIcons name="schedule" size={sizes.iconSm} color={colors.danger} />
              <Text style={[typography.label, { color: colors.danger, flex: 1 }]}>
                {t("items:review.expiresSoon", { when: t("collections:waiting.inDays", { count: daysUntil(current.expiresAt) }) })}
              </Text>
            </View>
          ) : null}
          <PhotoCompare pendingId={current.id} match={match} matchName={itemName} />
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.label, { color: colors.text }]}>{current.similars.length > 0 ? t("items:review.chooseMatch") : t("items:review.noMatches")}</Text>
            <MatchChips matches={current.similars} names={matchNames} selected={cap.selected} onSelect={(selected) => setCap((c) => (c ? { ...c, selected } : c))} />
          </View>
          <View onLayout={(e) => (formTop.current = e.nativeEvent.layout.y)}>
            <ReviewFields
              key={`${current.id}-${formVersion}`}
              attributes={attributes}
              draft={cap.draft}
              onDraft={(update) => setCap((c) => (c ? { ...c, draft: update(c.draft) } : c))}
              quantity={cap.quantity}
              onQuantity={(quantity) => setCap((c) => (c ? { ...c, quantity: Math.max(1, quantity) } : c))}
              quantityOnly={!!match}
              onErrorChange={(key, hasError) => setFieldErrors((prev) => ({ ...prev, [key]: hasError }))}
              onFieldLayout={(id, y) => fieldY.current.set(id, y)}
            />
          </View>
        </ScrollView>
        {undo ? <UndoBar label={undo.label} onUndo={onUndo} /> : null}
        <ActionBar
          missing={missing}
          blockedText={blockedText}
          readyText={match ? t("items:review.readyMatch", { count: cap.quantity, name: itemName }) : t("items:review.readyNew", { count: cap.quantity, name: itemName })}
          onJumpTo={(id) => scrollRef.current?.scrollTo({ y: formTop.current + (fieldY.current.get(id) ?? 0) - spacing.md, animated: true })}
          onAdd={() => {
            const input = toInput(current, cap, attributes);
            const pendingId = current.id;
            hold("add", t("items:review.added", { name: itemName }), async () => {
              await pendingApi.add(pendingId, input);
            });
          }}
          onSkip={() => hold("skip", t("items:review.skipped"), async () => {})}
          onDelete={() => {
            const pendingId = current.id;
            hold("delete", t("items:review.deleted"), () => pendingApi.remove(pendingId));
          }}
          bottomInset={bottomInset}
        />
      </>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      {body()}
      {/* The last cap's Undo must stay reachable on the "nothing waiting" / end screens too. */}
      {undo && !current ? (
        <View style={{ paddingBottom: insets.bottom }}>
          <UndoBar label={undo.label} onUndo={onUndo} />
        </View>
      ) : null}
      <ReviewHelpSheet visible={help.open} onClose={help.hide} />
    </SafeAreaView>
  );
}

export default Review;
