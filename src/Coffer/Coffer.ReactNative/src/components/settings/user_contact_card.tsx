import { endpoints } from "@/src/const/endpoints";
import { useCreateData } from "@/src/hooks/data_hooks";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import { UserContact, UserContactRequired } from "@/src/types/entities/user_contact";
import UserContactBulkPayload, { UserContactUpdate } from "@/src/types/helpers/user_contact_bulk_playload";
import UserContactPlatfrom from "@/src/types/helpers/user_contact_platform";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { SectionHeader } from "../custom_ui/card";
import CustomButton from "../custom_ui/custom_button";
import ReputationSummary from "../market/review/reputation_summary";
import AddContactOverlay from "./user_settings/add_contact_overlay";

interface UserContactCardProps {
  user: User | null;
  setUser?: (user: User) => void;
  otherUser?: boolean;
}

const PLATFORMS = [UserContactPlatfrom.Phone, UserContactPlatfrom.Email, UserContactPlatfrom.Facebook];
const platformKey = (p: UserContactPlatfrom) => UserContactPlatfrom[p].toLowerCase();

function PlatformIcon({ platform }: { platform: UserContactPlatfrom }) {
  if (platform === UserContactPlatfrom.Phone) return <MaterialIcons name="phone" size={sizes.iconMd} color={colors.text} />;
  if (platform === UserContactPlatfrom.Email) return <MaterialIcons name="mail" size={sizes.iconMd} color={colors.text} />;
  return <Image source={require("../../../assets/images/facebook_icon.png")} style={{ width: sizes.iconMd, height: sizes.iconMd }} />;
}

/** The platform's "open" link, or null when the contact can't be opened (e.g. Facebook without a username). */
function contactUrl(contact: UserContact) {
  switch (contact.platform) {
    case UserContactPlatfrom.Phone:
      return `tel:${contact.value}`;
    case UserContactPlatfrom.Email:
      return `mailto:${contact.value}`;
    case UserContactPlatfrom.Facebook:
      return contact.link && contact.fullUrl ? contact.fullUrl : null;
    default:
      return null;
  }
}

/**
 * Marketplace contact card: phone, e-mail and Facebook, plus the reputation summary. Others tap a contact to call,
 * mail or open it; the owner edits all of them as a draft and saves them in one bulk request.
 */
function UserContactCard({ user, setUser, otherUser = false }: UserContactCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<UserContact[]>(user?.contacts ?? []);
  const [overlayPlatform, setOverlayPlatform] = useState<UserContactPlatfrom | null>(null);

  const { mutateAsync: updateContacts, isPending } = useCreateData<UserContactBulkPayload, UserContact[]>(
    endpoints.userContactBulk,
    undefined,
    t("settings:contacts.saved"),
    t("settings:contacts.saveFailed"),
  );

  if (!user) return null;

  const shown = editing ? draft : user.contacts ?? [];
  const contactFor = (p: UserContactPlatfrom) => shown.find((c) => c.platform === p) ?? null;

  const save = async () => {
    const draftIds = draft.map((c) => c.id);
    const deleted = user.contacts.filter((c) => !draftIds.includes(c.id)).map((c) => c.id);
    const created: UserContactRequired[] = [];
    const updated: UserContactUpdate[] = [];
    draft.forEach(({ id, createdAt, ...rest }) => {
      if (id.endsWith("_new")) created.push(rest);
      else updated.push({ id, value: rest });
    });
    try {
      const contacts = await updateContacts({ value: { created, updated, deleted } });
      setUser?.({ ...user, contacts });
      setEditing(false);
    } catch {
      // the mutation shows the error toast; the draft stays for another try
    }
  };

  const upsert = (contact: UserContact) =>
    setDraft((prev) => (prev.some((c) => c.id === contact.id) ? prev.map((c) => (c.id === contact.id ? contact : c)) : [...prev, contact]));

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, backgroundColor: colors.surfaceAlt, padding: spacing.sm }}>
        <MaterialIcons name="info-outline" size={sizes.iconMd} color={colors.text} />
        <Text style={[typography.meta, { color: colors.text, flex: 1 }]}>{otherUser ? t("settings:contacts.infoOther") : t("settings:contacts.infoOwn")}</Text>
      </View>

      <View>
        <SectionHeader title={t("settings:contacts.title")} />
        <View style={{ borderWidth: borders.width, borderColor: colors.border }}>
          {PLATFORMS.map((platform, i) => {
            const contact = contactFor(platform);
            const url = contact ? contactUrl(contact) : null;
            const label = t(`settings:contacts.platform.${platformKey(platform)}`);
            const value = contact?.value || t("settings:contacts.none");
            const onPress = editing ? () => setOverlayPlatform(platform) : url ? () => Linking.openURL(url) : undefined;
            return (
              <View
                key={platform}
                style={{ flexDirection: "row", alignItems: "center", borderTopWidth: i === 0 ? 0 : borders.hairline, borderColor: colors.borderMuted }}
              >
                <Pressable
                  onPress={onPress}
                  disabled={!onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}: ${value}`}
                  accessibilityHint={editing ? t("settings:contacts.editHint") : url ? t("settings:contacts.openHint") : undefined}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    minHeight: 64,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                  })}
                >
                  <PlatformIcon platform={platform} />
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
                    <Text style={[contact ? typography.bodyStrong : typography.body, { color: contact ? colors.text : colors.textMuted }]}>{value}</Text>
                  </View>
                  {editing ? (
                    <MaterialIcons name="edit" size={sizes.iconSm} color={colors.text} />
                  ) : url ? (
                    <MaterialIcons name="open-in-new" size={sizes.iconSm} color={colors.text} />
                  ) : null}
                </Pressable>
                {editing && contact ? (
                  <Pressable
                    onPress={() => setDraft((prev) => prev.filter((c) => c.id !== contact.id))}
                    accessibilityRole="button"
                    accessibilityLabel={t("settings:contacts.remove", { platform: label })}
                    style={({ pressed }) => ({
                      width: sizes.touch + spacing.xs,
                      alignSelf: "stretch",
                      alignItems: "center",
                      justifyContent: "center",
                      borderLeftWidth: borders.hairline,
                      borderColor: colors.borderMuted,
                      backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
                    })}
                  >
                    <MaterialIcons name="delete-outline" size={sizes.iconMd} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      {!otherUser ? (
        editing ? (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <CustomButton title={t("common:actions.cancel")} variant="outline" disabled={isPending} onPress={() => setEditing(false)} containerStyle={{ flex: 1 }} />
            <CustomButton title={t("common:actions.save")} loading={isPending} disabled={isPending} onPress={save} containerStyle={{ flex: 1 }} />
          </View>
        ) : (
          <CustomButton
            title={t("settings:contacts.edit")}
            variant="outline"
            size="sm"
            icon={<MaterialIcons name="edit" size={sizes.iconSm} color={colors.text} />}
            onPress={() => {
              setDraft(user.contacts ?? []);
              setEditing(true);
            }}
            containerStyle={{ alignSelf: "flex-start" }}
          />
        )
      ) : null}

      <View>
        <SectionHeader title={t("settings:contacts.reputation")} />
        <ReputationSummary userId={user.id} userName={user.name} isMe={!otherUser} />
      </View>

      <AddContactOverlay
        visible={overlayPlatform !== null}
        onClose={() => setOverlayPlatform(null)}
        user={user}
        selectedPlatform={overlayPlatform ?? UserContactPlatfrom.Phone}
        selectedContact={draft.find((c) => c.platform === overlayPlatform)}
        onSave={upsert}
      />
    </View>
  );
}

export default UserContactCard;
