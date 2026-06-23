// Профиль другого пользователя (только просмотр): инфо + его активности
// (предстоящие и прошедшие). Открывается с карточки свайпа и из списка чатов.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { getActivitiesByOwner, getUser } from '../services/data';
import { splitUpcomingPast } from '../utils/datetime';
import ActivityList from '../components/ActivityList';
import { colors, spacing, radius } from '../theme';
import type { Activity, UserProfile } from '../types';

type UserProfileRoute = RouteProp<
  {
    UserProfile: {
      userId: string;
      name?: string;
      avatarUrl?: string;
      rating?: number;
    };
  },
  'UserProfile'
>;

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={16}
          color={colors.star}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );
}

export default function UserProfileScreen() {
  const route = useRoute<UserProfileRoute>();
  const { userId, name, avatarUrl, rating } = route.params;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [u, acts] = await Promise.all([getUser(userId), getActivitiesByOwner(userId)]);
      if (!active) return;
      setUser(u);
      setActivities(acts);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // Пока грузится — показываем то, что пришло из параметров (имя/аватар с карточки).
  const displayName = user?.name ?? name ?? 'Пользователь';
  const displayAvatar = user?.avatarUrl ?? avatarUrl;
  const displayRating = user?.rating ?? rating ?? 5;

  const { upcoming, past } = splitUpcomingPast(activities);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={40} color={colors.textMuted} />
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
          <Stars rating={displayRating} />

          {user?.city ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text style={styles.metaText}>{user.city}</Text>
            </View>
          ) : null}

          {user?.hobbies?.length ? (
            <View style={styles.chips}>
              {user.hobbies.map((h) => (
                <View key={h} style={styles.chip}>
                  <Text style={styles.chipText}>{h}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {user?.bio?.trim() ? (
            <Text style={styles.bio}>{user.bio.trim()}</Text>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
        ) : (
          <>
            <ActivityList
              title="Предстоящие активности"
              activities={upcoming}
              emptyText="Нет предстоящих активностей"
            />
            <ActivityList
              title="Прошедшие активности"
              activities={past}
              emptyText="Нет прошедших активностей"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: spacing.md },
  starsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  metaText: { color: colors.textMuted, fontSize: 15 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  chipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  bio: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
