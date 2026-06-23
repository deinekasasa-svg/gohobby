// Глобальное состояние авторизации и текущего пользователя.
// SMS-вход реализован как ЗАГЛУШКА (код всегда 123456), но структура готова
// к подключению реального Firebase Phone Auth (см. RegisterScreen + комментарии).

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getUser, saveUser } from '../services/data';
import type { TelegramIdentity, UserProfile } from '../types';

const ONBOARDING_KEY = '@gohobby/onboardingSeen';
const USER_KEY = '@gohobby/user';

interface AuthContextValue {
  initializing: boolean;
  onboardingSeen: boolean;
  pendingTelegram: TelegramIdentity | null; // Telegram подтверждён, профиль ещё не создан
  currentUser: UserProfile | null;

  completeOnboarding: () => Promise<void>;
  // Telegram-вход подтверждён ботом: входим существующим юзером или ведём к созданию профиля.
  finishTelegramLogin: (identity: TelegramIdentity) => Promise<void>;
  completeProfile: (
    data: Pick<UserProfile, 'name' | 'city' | 'hobbies' | 'avatarUrl' | 'birthDate' | 'location' | 'bio'>,
  ) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [onboardingSeen, setOnboardingSeen] = useState(false);
  const [pendingTelegram, setPendingTelegram] = useState<TelegramIdentity | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Восстановление сессии из AsyncStorage при старте.
  useEffect(() => {
    (async () => {
      try {
        const [seen, userRaw] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        setOnboardingSeen(seen === 'true');
        if (userRaw) setCurrentUser(JSON.parse(userRaw) as UserProfile);
      } catch {
        // игнорируем — стартуем как первый запуск
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const completeOnboarding = async () => {
    setOnboardingSeen(true);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  };

  // Бот подтвердил вход. Если профиль уже есть — входим, иначе ведём к созданию.
  const finishTelegramLogin = async (identity: TelegramIdentity) => {
    const existing = await getUser(`tg_${identity.id}`);
    if (existing) {
      setCurrentUser(existing);
      setPendingTelegram(null);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(existing));
    } else {
      setPendingTelegram(identity);
    }
  };

  const completeProfile = async (
    data: Pick<UserProfile, 'name' | 'city' | 'hobbies' | 'avatarUrl' | 'birthDate' | 'location' | 'bio'>,
  ) => {
    const tg = pendingTelegram;
    const id = tg ? `tg_${tg.id}` : `user_${Date.now()}`;
    const user: UserProfile = {
      id,
      phone: '',
      name: data.name,
      city: data.city,
      telegramId: tg?.id,
      telegramUsername: tg?.username || undefined,
      birthDate: data.birthDate ?? null,
      hobbies: data.hobbies,
      bio: data.bio?.trim() || '', // не пишем undefined (Firestore его не принимает)
      avatarUrl: data.avatarUrl || `https://i.pravatar.cc/300?u=${encodeURIComponent(id)}`,
      rating: 5,
      location: data.location ?? null,
    };
    await saveUser(user);
    setCurrentUser(user);
    setPendingTelegram(null);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  };

  const updateProfile = async (patch: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...patch };
    await saveUser(updated);
    setCurrentUser(updated);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
  };

  const signOut = async () => {
    setCurrentUser(null);
    setPendingTelegram(null);
    await AsyncStorage.removeItem(USER_KEY);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      onboardingSeen,
      pendingTelegram,
      currentUser,
      completeOnboarding,
      finishTelegramLogin,
      completeProfile,
      updateProfile,
      signOut,
    }),
    [initializing, onboardingSeen, pendingTelegram, currentUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри <AuthProvider>');
  return ctx;
}
