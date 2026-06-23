// Модальное окно взаимного мэтча.
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';

import { colors, radius, spacing } from '../theme';
import type { Activity } from '../types';

interface Props {
  visible: boolean;
  activity: Activity | null;
  onChat: () => void;
  onClose: () => void;
}

export default function MatchModal({ visible, activity, onChat, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>У вас мэтч!</Text>
          <Text style={styles.subtitle}>Хотите договориться о встрече?</Text>

          {activity && (
            <View style={styles.activityRow}>
              <Image source={{ uri: activity.ownerAvatar }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activityName}>{activity.ownerName}</Text>
                <Text style={styles.activityHobby}>{activity.hobby}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={onChat} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Перейти в чат</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.secondaryText}>Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emoji: { fontSize: 56, marginBottom: spacing.sm },
  title: { color: colors.accent, fontSize: 28, fontWeight: '800' },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 6,
    textAlign: 'center',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
  activityName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  activityHobby: { color: colors.accent, fontSize: 14, marginTop: 2 },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 14, marginTop: 4 },
  secondaryText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
