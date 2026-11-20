import { endpoints } from "@/src/const/endpoints";
import { useUserStore } from "@/src/hooks/user_store";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import { ActivityCategory, ActivityEntry, ActivityTarget } from "@/src/types/entities/activity";
import { sentenceParams } from "@/src/utils/activity_format";
import { formatDateTime, formatPrice, formatTimeAgo } from "@/src/utils/market_api";
import { openActivity } from "@/src/utils/open_activity";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";

type IconName = React.ComponentProps<typeof MaterialIcons>["name"];

/** The icon of each My activity category (menu rows and the default for its entries). */
export const CATEGORY_ICONS: Record<ActivityCategory, IconName> = {
  likes: "favorite-border",
  comments: "chat-bubble-outline",
  collection: "collections",
  follows: "bookmark-border",
  marketplace: "storefront",
  trades: "handshake",
  reports: "flag",
};

/** A more telling icon for some kinds; the rest use their category's. */
function kindIcon(entry: ActivityEntry): IconName {
  const [noun, verb] = entry.kind.split(".");
  if (noun === "reaction") return verb === "liked" ? "favorite" : verb === "unliked" ? "favorite-border" : "star-outline";
  if (verb === "deleted") return "delete-outline";
  if (verb === "edited") return "edit";
  if (noun === "offer") return "euro";
  if (noun === "meetup") return "event";
  if (noun === "review") return "rate-review";
  if (verb === "shipped") return "local-shipping";
  if (verb === "disputed") return "report-problem";
  return CATEGORY_ICONS[entry.category] ?? "history";
}

function thumbUri(target: ActivityTarget): string | null {
  if (!target.available || !target.image) return null;
  switch (target.type) {
    case "item":
    case "comment":
      return `${endpoints.itemsCoverImage}/${target.image}`;
    case "collection":
      return `${endpoints.collectionsCoverImage}/${target.image}`;
    default:
      return `${endpoints.listingImage}/${target.image}`;
  }
}

/**
 * One thing the user did: icon, sentence, the comment text for comments, a thumbnail when the target has an image,
 * and when. Tapping opens where it happened; a gone target reads "No longer available" and is not tappable.
 * Long-press switches between "2 h ago" and the full date and time.
 */
export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { t } = useTranslation();
  const { token } = useUserStore();
  const [fullTime, setFullTime] = useState(false);
  const { target } = entry;

  const params = sentenceParams(entry, {
    unavailable: t("activity:unavailable"),
    untitled: t("activity:untitled"),
    money: (cents) => formatPrice(cents),
    term: (key) => t(`activity:terms.${key}`),
  });
  const sentence = t(`activity:kinds.${entry.kind}`, params);
  const detail = !target.available ? t("activity:unavailable") : target.excerpt ? `“${target.excerpt}”` : null; // i18n-ignore (quotes around user text)
  const when = fullTime ? formatDateTime(entry.occurredAt) : formatTimeAgo(entry.occurredAt);
  const uri = thumbUri(target);
  const textColor = target.available ? colors.text : colors.textMuted;

  return (
    <Pressable
      onPress={target.available ? () => openActivity(entry) : undefined}
      onLongPress={() => setFullTime((v) => !v)}
      accessibilityRole={target.available ? "button" : "text"}
      accessibilityLabel={[sentence, detail, formatDateTime(entry.occurredAt)].filter(Boolean).join(", ")}
      accessibilityHint={target.available ? t("activity:openHint") : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 64,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed && target.available ? colors.surfaceAlt : colors.surface,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: borders.width,
          borderColor: target.available ? colors.border : colors.borderMuted,
          backgroundColor: colors.surfaceAlt,
        }}
      >
        <MaterialIcons name={kindIcon(entry)} size={sizes.iconMd} color={textColor} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[typography.bodyStrong, { color: textColor }]} numberOfLines={3}>
          {sentence}
        </Text>
        {detail ? (
          <Text style={[typography.meta, { color: target.available ? colors.text : colors.textMuted, fontStyle: target.available ? "normal" : "italic" }]} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
        <Text style={[typography.caption, { color: colors.textMuted }]}>{when}</Text>
      </View>
      {uri ? (
        <Image
          source={{ uri, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
          style={{ width: 48, height: 48, borderWidth: borders.width, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      {target.available ? <MaterialIcons name="chevron-right" size={sizes.iconMd} color={colors.text} /> : null}
    </Pressable>
  );
}

export default ActivityRow;
