import CustomText from "@/src/components/custom_ui/custom_text";
import CustomTextInput from "@/src/components/custom_ui/custom_text_input";
import { useCitySearch } from "@/src/hooks/market_api";
import { customTheme } from "@/src/theme/theme";
import { City } from "@/src/types/entities/market";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";

const c = customTheme.colors;

export function cityLabel(city: City) {
  return [city.name, city.admin1 && city.admin1 !== city.name ? city.admin1 : null, city.countryCode]
    .filter(Boolean)
    .join(", ");
}

/** Type 2+ letters → pick a city (looked up through the backend's free geocoding proxy). */
function CityAutocomplete({
  value,
  onChange,
  label = "City",
  errorMessage,
}: {
  value?: City | null;
  onChange: (city: City | null) => void;
  label?: string;
  errorMessage?: string;
}) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(text), 350);
    return () => clearTimeout(timeout);
  }, [text]);

  const { data: cities = [], isFetching, isError } = useCitySearch(debounced);

  if (value) {
    return (
      <View style={{ gap: 4, marginBottom: 6 }}>
        <CustomText style={{ fontFamily: "VendSansBold" }}>{label}</CustomText>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 2,
            borderColor: c.primary,
            backgroundColor: c.secondary,
            padding: 8,
            gap: 6,
          }}
        >
          <MaterialIcons name="place" size={18} color={c.primary} />
          <CustomText style={{ flex: 1 }}>{cityLabel(value)}</CustomText>
          <TouchableOpacity onPress={() => onChange(null)} accessibilityLabel="Clear city" hitSlop={8}>
            <MaterialIcons name="close" size={20} color={c.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      <CustomTextInput
        label={label}
        placeholder="Start typing a city…"
        value={text}
        onChangeText={setText}
        errorMessage={errorMessage}
        rightIcon={isFetching ? <ActivityIndicator color={c.primary} /> : undefined}
      />
      {isError ? <CustomText style={{ color: "red", fontSize: 13 }}>City search is unavailable right now.</CustomText> : null}
      {debounced.trim().length >= 2 && !isFetching && cities.length === 0 && !isError ? (
        <CustomText style={{ fontSize: 13 }}>No city found.</CustomText>
      ) : null}
      {cities.map((city) => (
        <TouchableOpacity
          key={city.id}
          onPress={() => {
            onChange(city);
            setText("");
          }}
          style={{ padding: 8, borderBottomWidth: 1, borderColor: c.primary, flexDirection: "row", gap: 6 }}
        >
          <MaterialIcons name="place" size={18} color={c.secondary} />
          <CustomText>{cityLabel(city)}</CustomText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default CityAutocomplete;
