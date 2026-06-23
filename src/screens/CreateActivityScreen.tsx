// Создание активности (открывается как модальное окно из «+» в таб-баре).
// После публикации активность попадает в общий пул карточек.

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
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useAuth } from '../context/AuthContext';
import { addActivity, updateActivity, uploadImageAsync } from '../services/data';
import { notifyError, notifySuccess } from '../services/toast';
import DateField from '../components/DateField';
import CityField from '../components/CityField';
import { colors, HOBBIES, radius, spacing } from '../theme';
import type { Activity, GeoPoint } from '../types';
import { useRoute } from '@react-navigation/native';

export default function CreateActivityScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const existing: Activity | undefined = route.params?.activity;
  const isEdit = !!existing;
  const { currentUser } = useAuth();

  const [hobby, setHobby] = useState(existing?.hobby ?? '');
  const [customHobbies, setCustomHobbies] = useState<string[]>(
    existing && !HOBBIES.includes(existing.hobby) ? [existing.hobby] : [],
  );
  const [customInput, setCustomInput] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date>(() => {
    if (existing) return new Date(existing.date);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(19, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    if (existing) return existing.endDate ? new Date(existing.endDate) : new Date(existing.date);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(21, 0, 0, 0);
    return d;
  });
  // Город активности: при создании по умолчанию — город пользователя,
  // но его можно сменить (активность может быть в другом городе).
  const [city, setCity] = useState(existing?.ownerCity ?? currentUser?.city ?? '');
  const [cityLocation, setCityLocation] = useState<GeoPoint | null>(
    existing?.ownerLocation ?? currentUser?.location ?? null,
  );
  const [place, setPlace] = useState(existing?.place ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [spots, setSpots] = useState(existing?.totalSpots ?? 2);
  const [saving, setSaving] = useState(false);

  const allChips = [...HOBBIES, ...customHobbies];
  const chosenHobby = hobby;

  // Привязываем активность к координатам выбранного города (центр города из подсказки).
  const handleCitySelect = (cityName: string, location: GeoPoint) => {
    setCity(cityName);
    setCityLocation(location);
  };

  const addCustomHobby = () => {
    const h = customInput.trim();
    if (!h) return;
    if (!allChips.includes(h)) setCustomHobbies((p) => [...p, h]);
    setHobby(h);
    setCustomInput('');
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notifyError('Нужно разрешение на доступ к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  };

  const handlePublish = async () => {
    if (!currentUser) return;
    if (!chosenHobby) return notifyError('Выберите или впишите хобби');
    if (!isEdit && !photoUri) return notifyError('Добавьте фото активности');
    if (!city.trim()) return notifyError('Выберите город активности');
    if (!place.trim()) return notifyError('Укажите место встречи');

    setSaving(true);
    try {
      const photoUrl = photoUri
        ? await uploadImageAsync(photoUri, `activities/${Date.now()}.jpg`)
        : (existing?.photoUrl ?? '');

      if (isEdit && existing) {
        await updateActivity(existing.id, {
          hobby: chosenHobby,
          photoUrl,
          ownerCity: city.trim(),
          ownerLocation: cityLocation,
          date: startDate.toISOString(),
          endDate: endDate.toISOString(),
          place: place.trim(),
          description: description.trim(),
          totalSpots: spots,
        });
        notifySuccess('Активность обновлена');
      } else {
        const ownerAge = currentUser.birthDate
          ? (() => {
              const b = new Date(currentUser.birthDate);
              const now = new Date();
              let age = now.getFullYear() - b.getFullYear();
              const m = now.getMonth() - b.getMonth();
              if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
              return age;
            })()
          : null;
        await addActivity({
          ownerId: currentUser.id,
          ownerName: currentUser.name,
          ownerAvatar: currentUser.avatarUrl,
          ownerRating: currentUser.rating,
          ownerAge,
          ownerCity: city.trim(),
          ownerLocation: cityLocation,
          hobby: chosenHobby,
          photoUrl,
          date: startDate.toISOString(),
          endDate: endDate.toISOString(),
          place: place.trim(),
          description: description.trim(),
          totalSpots: spots,
          takenSpots: 0,
        });
        notifySuccess('Активность опубликована');
      }
      navigation.goBack();
    } catch (e) {
      notifyError(isEdit ? 'Не удалось обновить активность' : 'Не удалось опубликовать активность');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>{isEdit ? 'Редактирование' : 'Новая активность'}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Фото активности</Text>
          <TouchableOpacity style={styles.photoBox} onPress={pickPhoto} activeOpacity={0.8}>
            {(photoUri ?? existing?.photoUrl) ? (
              <Image source={{ uri: photoUri ?? existing?.photoUrl }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={40} color={colors.textMuted} />
                <Text style={styles.photoHint}>Загрузить из галереи</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Хобби</Text>
          <View style={styles.chips}>
            {allChips.map((h) => {
              const active = hobby === h;
              return (
                <TouchableOpacity
                  key={h}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setHobby(h)}
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

          <Text style={styles.label}>Начало</Text>
          <View style={styles.dateRow}>
            <View style={styles.flex}>
              <DateField
                value={startDate}
                onChange={(d) => setStartDate((prev) => {
                  const next = new Date(prev);
                  next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                  return next;
                })}
                mode="date"
                format={(d) => format(d, 'd MMM yyyy', { locale: ru })}
                icon="calendar-outline"
              />
            </View>
            <View style={styles.timeCol}>
              <DateField
                value={startDate}
                onChange={(d) => setStartDate((prev) => {
                  const next = new Date(prev);
                  next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  return next;
                })}
                mode="time"
                minuteInterval={10}
                format={(d) => format(d, 'HH:mm')}
                icon="time-outline"
              />
            </View>
          </View>

          <Text style={styles.label}>Конец</Text>
          <View style={styles.dateRow}>
            <View style={styles.flex}>
              <DateField
                value={endDate}
                onChange={(d) => setEndDate((prev) => {
                  const next = new Date(prev);
                  next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                  return next;
                })}
                mode="date"
                format={(d) => format(d, 'd MMM yyyy', { locale: ru })}
                icon="calendar-outline"
              />
            </View>
            <View style={styles.timeCol}>
              <DateField
                value={endDate}
                onChange={(d) => setEndDate((prev) => {
                  const next = new Date(prev);
                  next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  return next;
                })}
                mode="time"
                minuteInterval={10}
                format={(d) => format(d, 'HH:mm')}
                icon="time-outline"
              />
            </View>
          </View>

          <Text style={styles.label}>Город</Text>
          <CityField
            value={city}
            onSelect={handleCitySelect}
            placeholder="В каком городе активность?"
          />

          <Text style={styles.label}>Место</Text>
          <TextInput
            style={styles.input}
            value={place}
            onChangeText={setPlace}
            placeholder="Где встречаемся? (адрес, заведение)"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Описание</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Расскажи подробности: уровень, что взять с собой…"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.label}>Количество мест</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setSpots((s) => Math.max(2, s - 1))}
            >
              <Ionicons name="remove" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{spots}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setSpots((s) => Math.min(20, s + 1))}
            >
              <Ionicons name="add" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.submit}
            onPress={handlePublish}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{isEdit ? 'Сохранить' : 'Опубликовать'}</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  label: { color: colors.textSecondary, fontSize: 14, marginBottom: 8, marginTop: spacing.md },
  photoBox: {
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoHint: { color: colors.textMuted, fontSize: 14, marginTop: 8 },
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
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  customRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  timeCol: { width: 100 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepValue: { color: colors.text, fontSize: 20, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
