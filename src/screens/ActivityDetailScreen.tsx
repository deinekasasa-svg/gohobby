// Просмотр активности — открывается по нажатию на строку в «Мои активности».

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

import { colors, radius, spacing } from '../theme';
import type { Activity } from '../types';

type ActivityDetailRoute = RouteProp<{ ActivityDetail: { activity: Activity } }, 'ActivityDetail'>;

function formatDateRange(start: string, end?: string): string {
  const s = new Date(start);
  const timeStart = format(s, 'HH:mm');
  const day = format(s, 'd MMMM yyyy', { locale: ru });
  if (!end) return `${day} · ${timeStart}`;
  const timeEnd = format(new Date(end), 'HH:mm');
  return `${day} · ${timeStart} — ${timeEnd}`;
}

export default function ActivityDetailScreen() {
  const navigation = useNavigation<any>();
  const { activity } = useRoute<ActivityDetailRoute>().params;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{activity.hobby}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: activity.photoUrl }} style={styles.photo} contentFit="cover" />

        <Text style={styles.hobby}>{activity.hobby}</Text>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <Text style={styles.metaText}>{formatDateRange(activity.date, activity.endDate)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={colors.accent} />
            <Text style={styles.metaText}>
              {activity.ownerCity ? `${activity.ownerCity}, ${activity.place}` : activity.place}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={18} color={colors.accent} />
            <Text style={styles.metaText}>
              {activity.takenSpots} / {activity.totalSpots} мест занято
            </Text>
          </View>
        </View>

        {!!activity.description && (
          <>
            <Text style={styles.sectionLabel}>Описание</Text>
            <Text style={styles.description}>{activity.description}</Text>
          </>
        )}

        <Text style={styles.sectionLabel}>Организатор</Text>
        <View style={styles.ownerRow}>
          <Image source={{ uri: activity.ownerAvatar }} style={styles.ownerAvatar} />
          <View>
            <Text style={styles.ownerName}>
              {activity.ownerName}
              {activity.ownerAge != null ? `, ${activity.ownerAge}` : ''}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, alignItems: 'flex-start' },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { paddingBottom: spacing.xl * 2 },
  photo: { width: '100%', height: 260, backgroundColor: colors.surface },
  hobby: { color: colors.text, fontSize: 26, fontWeight: '800', margin: spacing.lg, marginBottom: spacing.sm },
  metaBlock: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { color: colors.textSecondary, fontSize: 15, flex: 1 },
  sectionLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: 6 },
  description: { color: colors.text, fontSize: 15, lineHeight: 22, marginHorizontal: spacing.lg },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: 6 },
  ownerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface },
  ownerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  ownerCity: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
