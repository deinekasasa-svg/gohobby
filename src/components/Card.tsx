// Карточка активности для свайпа (дизайн в стиле Tinder).
// Верхняя половина — фото активности, нижняя — тёмная панель с blur-эффектом.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../theme';
import { formatDateRange } from '../utils/datetime';
import type { Activity, GeoPoint } from '../types';

function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) {
    const m = Math.max(100, Math.round(km * 10) * 100);
    return `${m} м от вас`;
  }
  return `${km.toFixed(1)} км от вас`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={colors.star}
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.accent} style={{ marginRight: 8 }} />
      <Text style={styles.infoText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export default function Card({
  activity,
  userLocation,
}: {
  activity: Activity;
  userLocation?: GeoPoint | null;
}) {
  const left = activity.totalSpots - activity.takenSpots;

  const distanceLabel = (() => {
    if (userLocation && activity.ownerLocation) {
      const km = haversineKm(userLocation, activity.ownerLocation);
      return formatDistance(km);
    }
    return activity.ownerCity || null;
  })();

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: activity.photoUrl }}
        style={styles.photo}
        contentFit="cover"
        transition={200}
      />

      <BlurView intensity={30} tint="dark" style={styles.bottom}>
        <View style={styles.bottomOverlay}>
          <View style={styles.headerRow}>
            <View style={styles.ownerInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {activity.ownerName}
                {activity.ownerAge != null ? `, ${activity.ownerAge}` : ''}
              </Text>
              {distanceLabel ? (
                <Text style={styles.distanceText}>{distanceLabel}</Text>
              ) : null}
            </View>
            <Stars rating={activity.ownerRating} />
          </View>

          <View style={styles.hobbyPill}>
            <Text style={styles.hobbyText}>{activity.hobby}</Text>
          </View>

          <InfoRow icon="calendar-outline" text={formatDateRange(activity.date, activity.endDate)} />
          <InfoRow icon="location-outline" text={activity.place} />

          <Text style={styles.description} numberOfLines={2}>
            {activity.description}
          </Text>

          <View style={styles.spotsRow}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.spotsText}>
              {`Мест: ${activity.totalSpots}  (осталось ${left > 0 ? left : 0})`}
            </Text>
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: {
    width: '100%',
    height: '54%',
    backgroundColor: colors.surface,
  },
  bottom: {
    flex: 1,
  },
  bottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.82)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  ownerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  distanceText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hobbyPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  hobbyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    color: colors.text,
    fontSize: 15,
    flexShrink: 1,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  spotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  spotsText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '600',
  },
});
