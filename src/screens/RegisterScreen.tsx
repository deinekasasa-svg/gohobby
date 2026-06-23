// Вход через Telegram. Приложение создаёт одноразовый токен, открывает бота,
// пользователь жмёт Start → бот (Cloud Function) подтверждает вход, мы это
// видим в реальном времени и входим / ведём к созданию профиля.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import {
  createLoginToken,
  deleteLoginToken,
  subscribeLoginToken,
} from '../services/data';
import { IS_FIREBASE_CONFIGURED } from '../config/firebase';
import { telegramLoginLink } from '../config/telegram';
import { notifyError } from '../services/toast';
import { colors, radius, spacing } from '../theme';

function makeToken(): string {
  return `login_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function RegisterScreen() {
  const { finishTelegramLogin } = useAuth();
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (tokenRef.current) {
      deleteLoginToken(tokenRef.current);
      tokenRef.current = null;
    }
  }, []);

  // Снимаем подписку при уходе с экрана.
  useEffect(() => cleanup, [cleanup]);

  const startLogin = async () => {
    if (!IS_FIREBASE_CONFIGURED) {
      notifyError('Вход через Telegram недоступен: не настроен бэкенд');
      return;
    }
    setBusy(true);
    try {
      cleanup(); // на случай повторного запуска
      const token = makeToken();
      tokenRef.current = token;
      await createLoginToken(token);

      // Слушаем подтверждение от бота.
      unsubRef.current = subscribeLoginToken(token, (data) => {
        if (data?.status === 'confirmed' && data.telegram) {
          const identity = data.telegram;
          cleanup();
          setWaiting(false);
          finishTelegramLogin(identity); // дальше навигация сама
        }
      });

      // Открываем бота в Telegram.
      const url = telegramLoginLink(token);
      const ok = await Linking.canOpenURL(url).catch(() => false);
      await Linking.openURL(url).catch(() => {
        if (!ok) notifyError('Не удалось открыть Telegram');
      });

      setWaiting(true);
    } catch {
      notifyError('Не удалось начать вход. Попробуйте ещё раз');
      cleanup();
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    cleanup();
    setWaiting(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Ionicons name="people" size={40} color={colors.accent} />
        </View>
        <Text style={styles.appName}>GoHobby</Text>
        <Text style={styles.tagline}>Найди компанию по интересам рядом</Text>
      </View>

      <View style={styles.form}>
        {!waiting ? (
          <>
            <TouchableOpacity
              style={styles.tgButton}
              onPress={startLogin}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color="#fff" />
                  <Text style={styles.tgButtonText}>Войти через Telegram</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>
              Откроется бот @go_hobby_bot — нажмите «Start», и вы вернётесь в приложение.
            </Text>
          </>
        ) : (
          <View style={styles.waitBox}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.waitTitle}>Ожидаем подтверждение в Telegram…</Text>
            <Text style={styles.waitText}>
              Нажмите «Start» в открывшемся боте. Как только подтвердите — вход произойдёт
              автоматически.
            </Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={startLogin} activeOpacity={0.85}>
              <Text style={styles.secondaryText}>Открыть Telegram снова</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.link} onPress={cancel}>
              <Text style={styles.linkText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', paddingTop: spacing.xl * 2, paddingHorizontal: spacing.xl },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  appName: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.md },
  tagline: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: spacing.sm },
  form: { paddingHorizontal: spacing.xl, marginTop: spacing.xl * 2 },
  tgButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#229ED9', // фирменный синий Telegram
    borderRadius: radius.pill,
    paddingVertical: 16,
  },
  tgButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
  waitBox: { alignItems: 'center' },
  waitTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.lg, textAlign: 'center' },
  waitText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: spacing.xl,
  },
  secondaryText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  link: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { color: colors.textMuted, fontSize: 15 },
});
