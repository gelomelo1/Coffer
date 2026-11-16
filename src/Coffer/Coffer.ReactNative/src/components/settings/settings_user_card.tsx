import { borders, colors, fonts, spacing } from "@/src/theme/theme";
import User from "@/src/types/entities/user";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import UserContactCard from "./user_contact_card";
import UserInfoCard from "./user_info_card";

interface SettingsUserCardProps {
  user: User | null;
  setUser?: (user: User) => void;
  otherUser?: boolean;
}

/** Profile and marketplace contact card behind a two-tab segmented control (replaces the old swipe-only switch). */
function SettingsUserCard({ user, setUser, otherUser = false }: SettingsUserCardProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"profile" | "contacts">("profile");
  const tabs = [
    { key: "profile" as const, title: t("settings:profile.tab") },
    { key: "contacts" as const, title: t("settings:contacts.tab") },
  ];

  return (
    <View style={{ gap: spacing.md }}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", borderWidth: borders.width, borderColor: colors.border }}>
        {tabs.map((item, i) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing.xs,
                backgroundColor: active ? colors.secondary : pressed ? colors.surfaceAlt : colors.surface,
                borderLeftWidth: i === 0 ? 0 : borders.width,
                borderColor: colors.border,
              })}
            >
              <Text style={{ color: colors.text, fontFamily: active ? fonts.bold : fonts.regular, fontSize: 16, textAlign: "center" }}>{item.title}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === "profile" ? (
        <UserInfoCard user={user} setUser={setUser} otherUser={otherUser} />
      ) : (
        <UserContactCard user={user} setUser={setUser} otherUser={otherUser} />
      )}
    </View>
  );
}

export default SettingsUserCard;
