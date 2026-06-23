import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';
import type { GeoPoint } from '../types';

interface Suggestion {
  cityName: string;
  fullName: string;
  location: GeoPoint;
}

interface Props {
  value: string;
  onSelect: (city: string, location: GeoPoint) => void;
  placeholder?: string;
}

export default function CityField({ value, onSelect, placeholder = 'Например, Москва' }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(!!value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && value) {
      setQuery(value);
      setConfirmed(true);
      initialized.current = true;
    }
  }, [value]);

  const search = (text: string) => {
    setQuery(text);
    setConfirmed(false);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}` +
          `&format=json&limit=5&addressdetails=1&accept-language=ru`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'GoHobby/1.0 (expo app)' },
        });
        const data: any[] = await resp.json();
        const results: Suggestion[] = data.map((item) => {
          const addr = item.address ?? {};
          const cityName =
            addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? item.display_name.split(',')[0];
          return {
            cityName,
            fullName: item.display_name,
            location: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
          };
        });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const select = (s: Suggestion) => {
    setQuery(s.cityName);
    setSuggestions([]);
    setConfirmed(true);
    onSelect(s.cityName, s.location);
  };

  return (
    <View>
      <View style={[styles.inputWrap, confirmed && styles.inputConfirmed]}>
        <Ionicons
          name="location-outline"
          size={18}
          color={confirmed ? colors.accent : colors.textMuted}
        />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={search}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && <ActivityIndicator size="small" color={colors.accent} />}
        {confirmed && !loading && (
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.suggestion, i < suggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => select(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionCity}>{s.cityName}</Text>
              <Text style={styles.suggestionFull} numberOfLines={1}>
                {s.fullName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputConfirmed: { borderColor: colors.accent },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  dropdown: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionCity: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  suggestionFull: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
