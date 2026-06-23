// Экран диалога. Сообщения в реальном времени, отправка текстом.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import {
  acceptJoinRequest,
  declineJoinRequest,
  getActivityById,
  markChatRead,
  sendMessage,
  subscribeChat,
  subscribeMessages,
} from '../services/data';
import { notifyError, notifyInfo, notifySuccess } from '../services/toast';
import { colors, radius, spacing } from '../theme';
import type { Activity, Chat, ChatMessage } from '../types';

type ChatRoute = RouteProp<{ Chat: { chatId: string; title: string } }, 'Chat'>;

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ChatRoute>();
  const { chatId, title } = route.params;
  const { currentUser } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    const unsubMsg = subscribeMessages(chatId, setMessages);
    const unsubChat = subscribeChat(chatId, setChat);
    return () => {
      unsubMsg();
      unsubChat();
    };
  }, [chatId]);

  // Подтягиваем активность (для отображения мест и проверки доступности).
  const reloadActivity = useCallback(() => {
    if (chat?.activityId) getActivityById(chat.activityId).then(setActivity);
  }, [chat?.activityId]);

  useEffect(() => {
    reloadActivity();
  }, [reloadActivity]);

  // Открыли чат / пришло сообщение, пока он открыт → отмечаем прочитанным.
  useEffect(() => {
    if (currentUser) markChatRead(chatId, currentUser.id);
  }, [chatId, messages.length, currentUser]);

  const isOwner = !!chat && chat.activityOwnerId === currentUser?.id;
  const remaining = activity ? Math.max(0, activity.totalSpots - activity.takenSpots) : null;
  const canDecide = isOwner && chat?.requestStatus === 'pending';

  const handleSend = async () => {
    if (!text.trim() || !currentUser) return;
    const toSend = text;
    setText('');
    await sendMessage(chatId, currentUser.id, toSend);
  };

  const handleAccept = async () => {
    const res = await acceptJoinRequest(chatId);
    if (!res.ok && res.reason === 'full') {
      notifyError('Свободных мест больше нет');
    } else if (res.ok) {
      notifySuccess(res.full ? 'Принято! Все места заняты' : 'Участник принят');
    }
    reloadActivity();
  };

  const handleDecline = async () => {
    await declineJoinRequest(chatId);
    notifyInfo('Отказ отправлен');
  };

  const openActivity = () => {
    if (activity) navigation.navigate('ActivityDetail', { activity });
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    if (item.senderId === 'system') {
      return (
        <View style={styles.systemWrap}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }
    const mine = item.senderId === currentUser?.id;
    return (
      <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={mine ? styles.textMine : styles.textTheirs}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Плашка активности, к которой относится чат */}
        {chat && (
          <TouchableOpacity style={styles.activityBar} onPress={openActivity} activeOpacity={0.8}>
            {chat.activityPhoto ? (
              <Image source={{ uri: chat.activityPhoto }} style={styles.activityThumb} contentFit="cover" />
            ) : (
              <View style={[styles.activityThumb, styles.activityThumbFallback]}>
                <Ionicons name="calendar-outline" size={18} color={colors.accent} />
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.activityTitle} numberOfLines={1}>
                {chat.activityTitle}
              </Text>
              <Text style={styles.activitySub} numberOfLines={1}>
                {chat.requestStatus === 'accepted'
                  ? 'Заявка принята ✓'
                  : chat.requestStatus === 'declined'
                    ? 'Заявка отклонена'
                    : remaining != null
                      ? `Свободно мест: ${remaining}`
                      : 'Активность'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Принять / Отказать — только организатору, пока заявка в ожидании */}
        {canDecide && (
          <View style={styles.decideBar}>
            <TouchableOpacity
              style={[styles.decideBtn, styles.declineBtn]}
              onPress={handleDecline}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={18} color={colors.nope} />
              <Text style={[styles.decideText, { color: colors.nope }]}>Отказать</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.decideBtn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.85}
              disabled={remaining === 0}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={[styles.decideText, { color: '#fff' }]}>
                {remaining === 0 ? 'Мест нет' : 'Принять'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Сообщение…"
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend} activeOpacity={0.8}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  activityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface },
  activityThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  activityTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  activitySub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  decideBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  decideBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  acceptBtn: { backgroundColor: colors.accent },
  declineBtn: { borderWidth: 1, borderColor: colors.nope },
  decideText: { fontSize: 15, fontWeight: '700' },
  list: { padding: spacing.md, paddingBottom: spacing.md },
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  textMine: { color: '#fff', fontSize: 15 },
  textTheirs: { color: colors.text, fontSize: 15 },
  systemWrap: { alignItems: 'center', marginVertical: spacing.sm },
  systemText: {
    color: colors.textMuted,
    fontSize: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    textAlign: 'center',
    overflow: 'hidden',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
