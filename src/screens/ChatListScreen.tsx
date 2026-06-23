// Список диалогов. Подписка в реальном времени через дата-слой
// (Firestore onSnapshot или локальный pub/sub).

import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { subscribeChats } from '../services/data';
import { formatTime } from '../utils/datetime';
import { colors, radius, spacing } from '../theme';
import type { Chat } from '../types';

export default function ChatListScreen() {
  const navigation = useNavigation<any>();
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeChats(currentUser, setChats);
    return unsub;
  }, [currentUser]);

  const renderItem = ({ item }: { item: Chat }) => {
    const otherId = item.participants.find((p) => p !== currentUser?.id) ?? '';
    const name = item.participantNames[otherId] ?? 'Собеседник';
    const avatar = item.participantAvatars[otherId];
    const unread =
      item.lastSenderId !== currentUser?.id &&
      item.lastSenderId !== 'system' &&
      item.lastMessageAt > (item.readAt?.[currentUser?.id ?? ''] ?? 0);

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Chat', { chatId: item.id, title: name })}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('UserProfile', { userId: otherId, name, avatarUrl: avatar })
          }
        >
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </TouchableOpacity>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.time}>{formatTime(item.lastMessageAt)}</Text>
          </View>

          {/* Плашка: к какой активности относится чат */}
          {item.activityTitle ? (
            <View style={styles.activityTag}>
              <Ionicons name="calendar-outline" size={12} color={colors.accent} />
              <Text style={styles.activityTagText} numberOfLines={1}>
                {item.activityTitle}
              </Text>
            </View>
          ) : null}

          <View style={styles.rowBottom}>
            <Text style={[styles.last, unread && styles.lastUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {unread && <View style={styles.dot} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.header}>Сообщения</Text>
      {chats.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Пока нет диалогов</Text>
          <Text style={styles.emptyText}>Свайпай карточки — при мэтче появится чат</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, marginRight: spacing.md },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  nameUnread: { color: colors.text },
  time: { color: colors.textMuted, fontSize: 12 },
  activityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    maxWidth: '100%',
  },
  activityTagText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  last: { color: colors.textSecondary, fontSize: 14, flex: 1 },
  lastUnread: { color: colors.text, fontWeight: '600' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: 84 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14, marginTop: 6, textAlign: 'center' },
});
