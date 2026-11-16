import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { useCitySearch } from "@/src/hooks/market_api";
import { borders, colors, hitSlopFor, sizes, spacing, typography } from "@/src/theme/theme";
import { City } from "@/src/types/entities/market";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

export function cityLabel(city: City) {
  return [city.name, city.admin1 && city.admin1 !== city.name ? city.admin1 : null, city.countryCode]
    .filter(Boolean)
    .join(", "); // i18n-ignore
}

/** Type 2+ letters → pick a city (looked up through the backend's free geocoding proxy). */
function CityAutocomplete({
  value,
  onChange,
  label,
  errorMessage,
}: {
  value?: City | null;
  onChange: (city: City | null) => void;
  label?: string;
  errorMessage?: string;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const fieldLabel = label ?? t("market:city.label");

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(text), 350);
    return () => clearTimeout(timeout);
  }, [text]);

  const { data: cities = [], isFetching, isError } = useCitySearch(debounced);

  if (value) {
    return (
      <View style={{ gap: spacing.xxs, marginBottom: spacing.sm }}>
        <Text style={[typography.label, { color: colors.text }]}>{fieldLabel}</Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: sizes.control,
            borderWidth: borders.width,
            borderColor: colors.border,
            backgroundColor: colors.surfaceAlt,
            paddingLeft: spacing.sm,
            gap: spacing.xs,
          }}
        >
          <MaterialIcons name="place" size={sizes.iconSm} color={colors.text} />
          <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{cityLabel(value)}</Text>
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel={t("market:city.clear")}
            hitSlop={hitSlopFor(sizes.touch)}
            style={({ pressed }) => ({
              width: sizes.touch,
              height: sizes.touch,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <MaterialIcons name="close" size={sizes.iconMd} color={colors.text} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <CustomTextInput
        label={fieldLabel}
        placeholder={t("market:city.placeholder")}
        value={text}
        onChangeText={setText}
        errorMessage={errorMessage}
        autoCorrect={false}
        rightIcon={isFetching ? <ActivityIndicator color={colors.primary} /> : undefined}
      />
      {isError ? <Text style={[typography.meta, { color: colors.danger }]}>{t("market:city.unavailable")}</Text> : null}
      {debounced.trim().length >= 2 && !isFetching && cities.length === 0 && !isError ? (
        <Text style={[typography.meta, { color: colors.textMuted }]}>{t("market:city.noResults")}</Text>
      ) : null}
      {cities.length > 0 ? (
        <View style={{ borderWidth: borders.width, borderColor: colors.border, marginTop: spacing.xxs }}>
          {cities.map((city, i) => (
            <Pressable
              key={city.id}
              onPress={() => {
                onChange(city);
                setText("");
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                minHeight: sizes.touch,
                paddingHorizontal: spacing.sm,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                borderTopWidth: i === 0 ? 0 : borders.hairline,
                borderColor: colors.borderMuted,
                backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
              })}
            >
              <MaterialIcons name="place" size={sizes.iconSm} color={colors.text} />
              <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{cityLabel(city)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default CityAutocomplete;
