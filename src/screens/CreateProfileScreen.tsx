// Создание профиля: имя, город, до 10 хобби (чипсы + своё), аватар.
// Аватар грузится в Firebase Storage (если настроен), иначе остаётся локальным.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useAuth } from '../context/AuthContext';
import { uploadImageAsync } from '../services/data';
import { notifyError, notifyInfo } from '../services/toast';
import DateField from '../components/DateField';
import CityField from '../components/CityField';
import { colors, HOBBIES, radius, spacing } from '../theme';
import type { GeoPoint } from '../types';

const MAX_HOBBIES = 10;
const MAX_BIO = 500;

export default function CreateProfileScreen() {
  const { completeProfile, pendingTelegram } = useAuth();
  const [name, setName] = useState(
    [pendingTelegram?.firstName, pendingTelegram?.lastName].filter(Boolean).join(' ').trim(),
  );
  const [city, setCity] = useState('');
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [customHobbies, setCustomHobbies] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allChips = [...HOBBIES, ...customHobbies];

  const handleCitySelect = async (cityName: string, cityLocation: GeoPoint) => {
    setCity(cityName);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setLocation(cityLocation);
      }
    } else {
      notifyInfo('Расстояние до активностей не будет показано', 'Геолокация отключена');
      setLocation(null);
    }
  };

  const toggleHobby = (h: string) => {
    setSelected((prev) => {
      if (prev.includes(h)) return prev.filter((x) => x !== h);
      if (prev.length >= MAX_HOBBIES) {
        notifyError(`Можно выбрать не более ${MAX_HOBBIES} хобби`);
        return prev;
      }
      return [...prev, h];
    });
  };

  const addCustomHobby = () => {
    const h = customInput.trim();
    if (!h) return;
    if (![...allChips].includes(h)) setCustomHobbies((p) => [...p, h]);
    if (!selected.includes(h) && selected.length < MAX_HOBBIES) {
      setSelected((p) => [...p, h]);
    }
    setCustomInput('');
  };

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      notifyError('Нужно разрешение на доступ к ' + (fromCamera ? 'камере' : 'галерее'));
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
        });
    if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return notifyError('Введите имя');
    if (!city.trim()) return notifyError('Введите город');
    if (selected.length === 0) return notifyError('Выберите хотя бы одно хобби');

    setSaving(true);
    try {
      let avatarUrl = '';
      if (avatarUri) avatarUrl = await uploadImageAsync(avatarUri, `avatars/${Date.now()}.jpg`);
      await completeProfile({
        name: name.trim(),
        city: city.trim(),
        hobbies: selected,
        bio: bio.trim(),
        avatarUrl,
        birthDate: birthDate ? birthDate.toISOString() : null,
        location,
      });
      // Навигация на основной экран произойдёт автоматически (появился currentUser).
    } catch (e) {
      notifyError('Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Создай профиль</Text>

          <View style={styles.avatarSection}>
            <View style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <Ionicons name="person" size={48} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.avatarButtons}>
              <TouchableOpacity style={styles.avatarBtn} onPress={() => pickImage(false)}>
                <Ionicons name="image-outline" size={18} color={colors.accent} />
                <Text style={styles.avatarBtnText}>Галерея</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatarBtn} onPress={() => pickImage(true)}>
                <Ionicons name="camera-outline" size={18} color={colors.accent} />
                <Text style={styles.avatarBtnText}>Камера</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Имя</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Как тебя зовут?"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Город</Text>
          <CityField value={city} onSelect={handleCitySelect} />

          <Text style={styles.label}>Дата рождения</Text>
          <DateField
            value={birthDate}
            onChange={setBirthDate}
            maximumDate={new Date()}
            placeholder="Выбери дату рождения"
            format={(d) => format(d, 'd MMMM yyyy', { locale: ru })}
          />

          <Text style={styles.label}>Хобби (до {MAX_HOBBIES})</Text>
          <View style={styles.chips}>
            {allChips.map((h) => {
              const active = selected.includes(h);
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleHobby(h)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{h}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={[styles.input, styles.flex]}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="Своё хобби"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={addCustomHobby}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomHobby}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>Коротко о себе</Text>
            <Text style={styles.optional}>Необязательно — можно заполнить позже</Text>
          </View>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, MAX_BIO))}
            placeholder="Расскажи о себе: чем увлекаешься, что ищешь в компании…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_BIO}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>{bio.length}/{MAX_BIO}</Text>

          <TouchableOpacity
            style={styles.submit}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Продолжить</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  heading: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: spacing.lg },
  avatarSection: { alignItems: 'center', marginBottom: spacing.lg },
  avatarWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  avatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  label: { color: colors.textSecondary, fontSize: 14, marginBottom: 8, marginTop: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  optional: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bioInput: { minHeight: 110, paddingTop: 13 },
  counter: { color: colors.textMuted, fontSize: 12, alignSelf: 'flex-end', marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  customRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
