import FontAwesome from "@expo/vector-icons/FontAwesome";
import { none } from "@/src/const/emptyIdUpdate";
import { endpoints } from "@/src/const/endpoints";
import { useUpdateData } from "@/src/hooks/data_hooks";
import { borders, colors, sizes, spacing, typography } from "@/src/theme/theme";
import User, { UserFrontend } from "@/src/types/entities/user";
import { getCountryByCode, stringHasValue } from "@/src/utils/data_access_utils";
import { countryFlag, formatDate } from "@/src/utils/market_api";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Text, View } from "react-native";
import { Country } from "react-native-country-picker-modal";
import { Avatar } from "../custom_ui/avatar";
import { SectionHeader } from "../custom_ui/card";
import { CountryField } from "../custom_ui/country_field";
import CustomButton from "../custom_ui/custom_button";
import CustomHTMLView from "../custom_ui/custom_html_view";
import { RichTextField } from "../custom_ui/rich_text_field";
import ReputationSummary from "../market/review/reputation_summary";

export interface UserInfoCardProps {
  user: User | null;
  setUser?: (user: User) => void;
  otherUser?: boolean;
}

const countryName = (c: Country | null) => (c ? (typeof c.name === "string" ? c.name : c.name.common) : null);

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }} accessible accessibilityLabel={`${label}: ${value}`}>
      {icon}
      <Text style={[typography.meta, { color: colors.text, flexShrink: 1 }]}>
        <Text style={{ color: colors.textMuted }}>{label} </Text>
        {value}
      </Text>
    </View>
  );
}

/** The sign-in provider's logo (GitHub only for users from the development seed or made before it was removed). */
function ProviderIcon({ provider }: { provider: string }) {
  if (provider === "google")
    return <Image source={require("../../../assets/images/googlesignin.png")} style={{ width: 18, height: 18 }} />;
  if (provider === "facebook") return <FontAwesome name="facebook-official" size={18} color="#1877F2" />;
  if (provider === "reddit") return <FontAwesome name="reddit" size={18} color="#FF4500" />;
  return <Image source={require("../../../assets/images/githubsignin.png")} style={{ width: 18, height: 18, tintColor: colors.text }} />;
}

/**
 * Profile: avatar, name, country, member since, login provider (own profile) and the rich-text summary.
 * The owner edits country and summary in place; Save sends both, Cancel drops the draft.
 */
function UserInfoCard({ user, setUser, otherUser = false }: UserInfoCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [country, setCountry] = useState<Country | null>(null);
  const [draftCountry, setDraftCountry] = useState<Country | null>(null);
  const [draftSummary, setDraftSummary] = useState(user?.summary ?? "");


  const { mutateAsync: updateUser, isPending } = useUpdateData<UserFrontend, User>(endpoints.userFrontend);

  useEffect(() => {
    let cancelled = false;
    if (user?.country) {
      getCountryByCode(user.country).then((data) => {
        if (!cancelled) setCountry(data);
      });
    } else setCountry(null);
    return () => {
      cancelled = true;
    };
  }, [user?.country]);

  if (!user) return null;

  const startEdit = () => {
    setDraftCountry(country);
    setDraftSummary(user.summary ?? "");
    setEditing(true);
  };

  const save = async () => {
    try {
      const updated = await updateUser({
        id: none,
        value: {
          country: draftCountry?.cca2.toString() ?? user.country,
          summary: stringHasValue(draftSummary) ? draftSummary : undefined,
        },
      });
      setUser?.(updated);
      setEditing(false);
    } catch {
      // error toast comes from the mutation; keep the draft so nothing is lost
    }
  };

  const shownCountry = countryName(country);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
        <Avatar uri={user.avatar} size={80} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
            {user.name}
          </Text>
          {shownCountry && country ? (
            <Meta
              icon={
                <Text style={{ fontSize: 18 }} importantForAccessibility="no">
                  {countryFlag(country.cca2)}
                </Text>
              }
              label={t("settings:profile.country")}
              value={shownCountry}
            />
          ) : null}
          <Meta
            icon={<MaterialIcons name="event" size={sizes.iconSm} color={colors.text} />}
            label={t("settings:profile.memberSince")}
            value={formatDate(user.createdAt)}
          />
          {!otherUser && user.provider ? (
            <Meta
              icon={<ProviderIcon provider={user.provider} />}
              label={t("settings:profile.loggedInWith")}
              value={t(`settings:profile.provider.${user.provider}`, { defaultValue: user.provider })}
            />
          ) : null}
        </View>
      </View>

      {!otherUser && !editing ? (
        <CustomButton
          title={t("settings:profile.edit")}
          variant="outline"
          size="sm"
          icon={<MaterialIcons name="edit" size={sizes.iconSm} color={colors.text} />}
          onPress={startEdit}
          containerStyle={{ alignSelf: "flex-start" }}
        />
      ) : null}

      {editing ? (
        <View style={{ gap: spacing.md, borderWidth: borders.width, borderColor: colors.border, padding: spacing.md, backgroundColor: colors.surface }}>
          <CountryField label={t("settings:profile.country")} value={draftCountry} onSelect={setDraftCountry} />
          <RichTextField
            label={t("settings:user.summaryEditorTitle")}
            value={draftSummary}
            onChangeValue={setDraftSummary}
            placeholder={t("settings:user.summaryPlaceholder")}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <CustomButton
              title={t("common:actions.cancel")}
              variant="outline"
              disabled={isPending}
              onPress={() => setEditing(false)}
              containerStyle={{ flex: 1 }}
            />
            <CustomButton title={t("common:actions.save")} loading={isPending} disabled={isPending} onPress={save} containerStyle={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <SectionHeader title={t("settings:profile.summary")} />
          {stringHasValue(user.summary) ? (
            <View style={{ marginHorizontal: -spacing.sm }}>
              <CustomHTMLView content={user.summary ?? ""} foldable />
            </View>
          ) : (
            <Text style={[typography.body, { color: colors.textMuted, fontStyle: "italic" }]}>
              {otherUser ? t("settings:profile.noSummaryOther") : t("settings:profile.noSummaryOwn")}
            </Text>
          )}
        </View>
      )}

      {!editing ? (
        <View>
          <SectionHeader title={t("settings:profile.reputation")} />
          <ReputationSummary userId={user.id} userName={user.name} isMe={!otherUser} />
        </View>
      ) : null}
    </View>
  );
}

export default UserInfoCard;
