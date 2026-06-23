// Секция со списком активностей (заголовок + строки). Используется в профиле
// текущего пользователя и в профиле другого человека.

import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { formatDateRange } from '../utils/datetime';
import { colors, radius, spacing } from '../theme';
import type { Activity } from '../types';

interface Props {
  title: string;
  activities: Activity[];
  emptyText: string;
  onPress?: (activity: Activity) => void;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
  onChat?: (activity: Activity) => void;
}

export default function ActivityList({ title, activities, emptyText, onPress, onEdit, onDelete, onChat }: Props) {
  const handleDelete = (a: Activity) => {
    Alert.alert(
      'Удалить активность?',
      `«${a.hobby}» будет удалена без возможности восстановления.`,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: () => onDelete?.(a) },
      ],
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.count}>{activities.length}</Text>
      </View>

      {activities.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        activities.map((a) => (
          <TouchableOpacity
            key={a.id}
            style={styles.row}
            onPress={() => onPress?.(a)}
            activeOpacity={onPress ? 0.7 : 1}
          >
            <Image source={{ uri: a.photoUrl }} style={styles.thumb} />
            <View style={styles.flex}>
              <Text style={styles.hobby}>{a.hobby}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {formatDateRange(a.date, a.endDate)} · {a.place}
              </Text>
            </View>
            {(onEdit || onDelete || onChat) && (
              <View style={styles.actions}>
                {onChat && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => onChat(a)}
                    hitSlop={8}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.accent} />
                  </TouchableOpacity>
                )}
                {onEdit && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => onEdit(a)}
                    hitSlop={8}
                  >
                    <Ionicons name="create-outline" size={20} color={colors.accent} />
                  </TouchableOpacity>
                )}
                {onDelete && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(a)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.nope} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  count: {
    color: colors.textMuted,
    fontSize: 13,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  empty: { color: colors.textMuted, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, marginRight: spacing.md, backgroundColor: colors.surface },
  hobby: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: spacing.sm },
  actionBtn: { padding: 6 },
});
