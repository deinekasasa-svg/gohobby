// Вкладка «Мои активности»: предстоящие и прошедшие активности текущего
// пользователя + быстрая кнопка создания.

import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import {
  createMatchChat,
  deleteActivity,
  getActivitiesByOwner,
  getLikedActivities,
} from '../services/data';
import { notifyError, notifySuccess } from '../services/toast';
import { splitUpcomingPast } from '../utils/datetime';
import ActivityList from '../components/ActivityList';
import { colors, radius, spacing } from '../theme';
import type { Activity } from '../types';

export default function MyActivitiesScreen() {
  const navigation = useNavigation<any>();
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [liked, setLiked] = useState<Activity[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUser) return;
      getActivitiesByOwner(currentUser.id).then(setActivities);
      getLikedActivities(currentUser.id).then(setLiked);
    }, [currentUser]),
  );

  const { upcoming, past } = splitUpcomingPast(activities);

  const handleView = (a: Activity) => navigation.navigate('ActivityDetail', { activity: a });
  const handleEdit = (a: Activity) => navigation.navigate('EditActivity', { activity: a });
  const handleDelete = async (a: Activity) => {
    try {
      await deleteActivity(a.id);
      setActivities((prev) => prev.filter((x) => x.id !== a.id));
      notifySuccess('Активность удалена');
    } catch {
      notifyError('Не удалось удалить активность');
    }
  };

  // Чат по активности из «Хочу пойти»: открываем (или создаём) чат с организатором.
  const handleChat = async (a: Activity) => {
    if (!currentUser) return;
    try {
      const chat = await createMatchChat(currentUser, a);
      navigation.navigate('Chat', { chatId: chat.id, title: a.ownerName });
    } catch {
      notifyError('Не удалось открыть чат');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Мои активности</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('CreateActivity')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createText}>Создать</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ActivityList
          title="Мои предстоящие"
          activities={upcoming}
          emptyText="Нет предстоящих активностей. Создай первую!"
          onPress={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <ActivityList
          title="Хочу пойти"
          activities={liked}
          emptyText="Свайпни активность вправо или нажми ♥ — она появится здесь"
          onPress={handleView}
          onChat={handleChat}
        />
        <ActivityList
          title="Прошедшие"
          activities={past}
          emptyText="Прошедших активностей пока нет"
          onPress={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: { color: colors.text, fontSize: 26, fontWeight: '800' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  createText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl * 2 },
});
