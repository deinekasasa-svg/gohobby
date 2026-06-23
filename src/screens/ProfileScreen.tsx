// Профиль: просмотр и редактирование (фото, имя, дата рождения, город, хобби),
// список «Мои активности» и выход.

import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import DateField from '../components/DateField';
import CityField from '../components/CityField';

import { useAuth } from '../context/AuthContext';
import { deleteActivity, getActivitiesByOwner, uploadImageAsync } from '../services/data';
import { notifyError, notifyInfo, notifySuccess } from '../services/toast';
import { splitUpcomingPast } from '../utils/datetime';
import ActivityList from '../components/ActivityList';
import { colors, HOBBIES, radius, spacing } from '../theme';
import type { Activity, GeoPoint } from '../types';
import { useNavigation } from '@react-navigation/native';

const MAX_BIO = 500;
const MAX_HOBBIES = 10;

function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { currentUser, updateProfile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name ?? '');
  const [city, setCity] = useState(currentUser?.city ?? '');
  const [location, setLocation] = useState<GeoPoint | null>(currentUser?.location ?? null);
  const [hobbies, setHobbies] = useState<string[]>(currentUser?.hobbies ?? []);
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(currentUser?.birthDate ?? null);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) getActivitiesByOwner(currentUser.id).then(setMyActivities);
    }, [currentUser]),
  );

  if (!currentUser) return null;

  const { upcoming, past } = splitUpcomingPast(myActivities);
  const allChips = Array.from(new Set([...HOBBIES, ...hobbies]));

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

  const toggleHobby = (h: string) =>
    setHobbies((prev) =>
      prev.includes(h)
        ? prev.filter((x) => x !== h)
        : prev.length >= MAX_HOBBIES
          ? prev
          : [...prev, h],
    );

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notifyError('Нужно разрешение на доступ к галерее');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      const url = await uploadImageAsync(result.assets[0].uri, `avatars/${currentUser.id}.jpg`);
      await updateProfile({ avatarUrl: url });
      notifySuccess('Фото обновлено');
    }
  };

  const save = async () => {
    if (!name.trim()) return notifyError('Введите имя');
    if (!city.trim()) return notifyError('Введите город');
    await updateProfile({ name: name.trim(), city: city.trim(), hobbies, bio: bio.trim(), birthDate, location });
    setEditing(false);
    notifySuccess('Профиль обновлён');
  };

  const handleViewActivity = (a: Activity) => navigation.navigate('ActivityDetail', { activity: a });
  const handleEditActivity = (a: Activity) => navigation.navigate('EditActivity', { activity: a });
  const handleDeleteActivity = async (a: Activity) => {
    try {
      await deleteActivity(a.id);
      setMyActivities((prev) => prev.filter((x) => x.id !== a.id));
      notifySuccess('Активность удалена');
    } catch {
      notifyError('Не удалось удалить активность');
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Выйти из аккаунта?', 'Сессия на этом устройстве будет завершена.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: () => signOut() },
    ]);

  const age = ageFrom(currentUser.birthDate);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.headerTitle}>Профиль</Text>
          <TouchableOpacity onPress={() => (editing ? save() : setEditing(true))} hitSlop={10}>
            <Text style={styles.editLink}>{editing ? 'Сохранить' : 'Изменить'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={editing ? changeAvatar : undefined} activeOpacity={editing ? 0.7 : 1}>
            <Image source={{ uri: currentUser.avatarUrl }} style={styles.avatar} />
            {editing && (
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {editing ? (
          <View>
            <Text style={styles.label}>Имя</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textMuted} />

            <Text style={styles.label}>Город</Text>
            <CityField value={city} onSelect={handleCitySelect} />

            <Text style={styles.label}>Дата рождения</Text>
            <DateField
              value={birthDate ? new Date(birthDate) : null}
              onChange={(d) => setBirthDate(d.toISOString())}
              maximumDate={new Date()}
              placeholder="Указать дату"
              format={(d) => format(d, 'd MMMM yyyy', { locale: ru })}
            />

            <Text style={styles.label}>Хобби (до {MAX_HOBBIES})</Text>
            <View style={styles.chips}>
              {allChips.map((h) => {
                const active = hobbies.includes(h);
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleHobby(h)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.labelRow}>
              <Text style={styles.label}>Коротко о себе</Text>
              <Text style={styles.optional}>Необязательно</Text>
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
          </View>
        ) : (
          <View style={styles.viewBlock}>
            <Text style={styles.name}>
              {currentUser.name}
              {age != null ? `, ${age}` : ''}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.metaText}>{currentUser.city}</Text>
            </View>
            <View style={styles.chips}>
              {currentUser.hobbies.map((h) => (
                <View key={h} style={[styles.chip, styles.chipStatic]}>
                  <Text style={styles.chipText}>{h}</Text>
                </View>
              ))}
            </View>
            {currentUser.bio?.trim() ? (
              <Text style={styles.bioText}>{currentUser.bio.trim()}</Text>
            ) : null}
          </View>
        )}

        <Text style={styles.sectionTitle}>Мои активности</Text>
        <ActivityList
          title="Мои предстоящие"
          activities={upcoming}
          emptyText="Нет предстоящих активностей"
          onPress={handleViewActivity}
          onEdit={handleEditActivity}
          onDelete={handleDeleteActivity}
        />
        <ActivityList
          title="Прошедшие"
          activities={past}
          emptyText="Нет прошедших активностей"
          onPress={handleViewActivity}
          onEdit={handleEditActivity}
          onDelete={handleDeleteActivity}
        />

        <TouchableOpacity style={styles.logout} onPress={confirmSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.nope} />
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  editLink: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  avatarSection: { alignItems: 'center', marginVertical: spacing.lg },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.surface },
  avatarBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  viewBlock: { alignItems: 'center' },
  name: { color: colors.text, fontSize: 24, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { color: colors.textMuted, fontSize: 15 },
  label: { color: colors.textSecondary, fontSize: 14, marginBottom: 8, marginTop: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
  bioText: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: { color: colors.text, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipStatic: { borderColor: colors.accent },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.xl, marginBottom: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityThumb: { width: 52, height: 52, borderRadius: radius.sm, marginRight: spacing.md, backgroundColor: colors.surface },
  activityHobby: { color: colors.text, fontSize: 16, fontWeight: '700' },
  activityMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.nope,
  },
  logoutText: { color: colors.nope, fontSize: 16, fontWeight: '700' },
});
