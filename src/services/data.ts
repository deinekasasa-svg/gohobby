// Единый дата-слой GoHobby.
// Если Firebase настроен (IS_FIREBASE_CONFIGURED) — работает через Firestore/Storage.
// Иначе — полностью локальный режим на мок-данных с in-memory pub/sub,
// чтобы приложение запускалось в Expo Go без бэкенда.

import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { db, storage, IS_FIREBASE_CONFIGURED } from '../config/firebase';
import { mockActivities, mockUsers } from '../data/mockData';
import { activityTitle } from '../utils/datetime';
import type { Activity, Chat, ChatMessage, TelegramIdentity, UserProfile } from '../types';

// ───────────────────────── Локальное хранилище (фолбэк) ─────────────────────

const localActivities: Activity[] = [...mockActivities];
const localUsers: Record<string, UserProfile> = Object.fromEntries(
  mockUsers.map((u) => [u.id, u]),
);
const localChats: Chat[] = [];
const localMessages: Record<string, ChatMessage[]> = {};
// «Хочу пойти»: активности, на которые юзер свайпнул вправо / лайкнул.
const localLikes: Record<string, { activity: Activity; createdAt: number }[]> = {};

type Listener = () => void;
const chatListeners = new Set<Listener>();
const messageListeners: Record<string, Set<Listener>> = {};

let demoChatSeeded = false;

function emitChats() {
  chatListeners.forEach((l) => l());
}
function emitMessages(chatId: string) {
  (messageListeners[chatId] ?? new Set<Listener>()).forEach((l) => l());
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

// Детерминированный id чата по паре участников + активности (чтобы не плодить дубли).
function chatIdFor(a: string, b: string, activityId: string): string {
  return [a, b].sort().join('__') + '__' + activityId;
}

// ─────────────────────────────── Активности ────────────────────────────────

export async function getActivities(excludeOwnerId?: string): Promise<Activity[]> {
  // Заполненные активности (мест не осталось) скрываем из ленты для всех.
  const hasSpots = (a: Activity) => a.takenSpots < a.totalSpots;
  if (IS_FIREBASE_CONFIGURED && db) {
    const snap = await getDocs(collection(db, 'activities'));
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Activity[];
    return list
      .filter((a) => a.ownerId !== excludeOwnerId && hasSpots(a))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return localActivities
    .filter((a) => a.ownerId !== excludeOwnerId && hasSpots(a))
    .sort((a, b) => b.createdAt - a.createdAt);
}

// Одна активность по id (для экрана чата: показать места, проверить доступность).
export async function getActivityById(id: string): Promise<Activity | null> {
  if (IS_FIREBASE_CONFIGURED && db) {
    const snap = await getDoc(doc(db, 'activities', id));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as Activity) : null;
  }
  return localActivities.find((a) => a.id === id) ?? null;
}

export async function getActivitiesByOwner(ownerId: string): Promise<Activity[]> {
  if (IS_FIREBASE_CONFIGURED && db) {
    const q = query(collection(db, 'activities'), where('ownerId', '==', ownerId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as object) }) as Activity)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  return localActivities
    .filter((a) => a.ownerId === ownerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addActivity(
  input: Omit<Activity, 'id' | 'createdAt'>,
): Promise<Activity> {
  const activity: Activity = { ...input, id: uid('act'), createdAt: Date.now() };
  if (IS_FIREBASE_CONFIGURED && db) {
    const docRef = await addDoc(collection(db, 'activities'), {
      ...input,
      createdAt: activity.createdAt,
    });
    activity.id = docRef.id;
  } else {
    localActivities.unshift(activity);
  }
  return activity;
}

export async function deleteActivity(id: string): Promise<void> {
  if (IS_FIREBASE_CONFIGURED && db) {
    await deleteDoc(doc(db, 'activities', id));
  } else {
    const idx = localActivities.findIndex((a) => a.id === id);
    if (idx !== -1) localActivities.splice(idx, 1);
  }
}

export async function updateActivity(
  id: string,
  data: Partial<Omit<Activity, 'id' | 'createdAt'>>,
): Promise<void> {
  if (IS_FIREBASE_CONFIGURED && db) {
    await updateDoc(doc(db, 'activities', id), data as Record<string, unknown>);
  } else {
    const idx = localActivities.findIndex((a) => a.id === id);
    if (idx !== -1) Object.assign(localActivities[idx], data);
  }
}

// ──────────────────────────────── Пользователи ─────────────────────────────

export async function saveUser(user: UserProfile): Promise<void> {
  if (IS_FIREBASE_CONFIGURED && db) {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });
  } else {
    localUsers[user.id] = user;
  }
}

export async function getUser(userId: string): Promise<UserProfile | null> {
  if (IS_FIREBASE_CONFIGURED && db) {
    const snap = await getDoc(doc(db, 'users', userId));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as UserProfile) : null;
  }
  return localUsers[userId] ?? null;
}

// ─────────────────────── Вход через Telegram (loginTokens) ──────────────────

export interface LoginTokenDoc {
  status: 'pending' | 'confirmed';
  telegram?: TelegramIdentity;
  createdAt?: number;
  confirmedAt?: number;
}

// Приложение создаёт одноразовый токен входа.
export async function createLoginToken(token: string): Promise<void> {
  if (!(IS_FIREBASE_CONFIGURED && db)) return;
  await setDoc(doc(db, 'loginTokens', token), { status: 'pending', createdAt: Date.now() });
}

// Подписка на статус токена: бот подтвердит вход → сюда придёт telegram-личность.
export function subscribeLoginToken(
  token: string,
  cb: (data: LoginTokenDoc | null) => void,
): () => void {
  if (!(IS_FIREBASE_CONFIGURED && db)) {
    cb(null);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'loginTokens', token),
    (snap) => cb(snap.exists() ? (snap.data() as LoginTokenDoc) : null),
    (err) => console.warn('[subscribeLoginToken] error:', err),
  );
}

export async function deleteLoginToken(token: string): Promise<void> {
  if (!(IS_FIREBASE_CONFIGURED && db)) return;
  try {
    await deleteDoc(doc(db, 'loginTokens', token));
  } catch {
    // не критично
  }
}

// ──────────────────────────── «Хочу пойти» (лайки) ─────────────────────────

// Запоминает активность, на которую юзер свайпнул вправо / нажал сердечко.
// Идемпотентно: повторный лайк той же активности не создаёт дубль.
export async function addLike(userId: string, activity: Activity): Promise<void> {
  const createdAt = Date.now();
  if (IS_FIREBASE_CONFIGURED && db) {
    await setDoc(
      doc(db, 'likes', `${userId}__${activity.id}`),
      { userId, activity, createdAt },
      { merge: true },
    );
    return;
  }
  const list = localLikes[userId] ?? (localLikes[userId] = []);
  if (!list.some((l) => l.activity.id === activity.id)) list.unshift({ activity, createdAt });
}

// Активности из «Хочу пойти», новые сверху.
export async function getLikedActivities(userId: string): Promise<Activity[]> {
  if (IS_FIREBASE_CONFIGURED && db) {
    const q = query(collection(db, 'likes'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as { activity: Activity; createdAt: number })
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((l) => l.activity);
  }
  return (localLikes[userId] ?? [])
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((l) => l.activity);
}

// ───────────────────────────── Загрузка фото ───────────────────────────────

// Возвращает публичный URL. Без настроенного Storage отдаёт локальный uri
// (приложение продолжает работать, фото видно владельцу устройства).
export async function uploadImageAsync(uri: string, path: string): Promise<string> {
  if (!IS_FIREBASE_CONFIGURED || !storage) return uri;
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[uploadImageAsync] загрузка не удалась, оставляю локальный uri:', e);
    return uri;
  }
}

// ──────────────────────────────── Мэтчи / чаты ─────────────────────────────

// Решает, случился ли взаимный мэтч при свайпе вправо.
// В MVP — вероятностно (имитация ответного лайка владельца активности).
export function isMutualMatch(): boolean {
  return Math.random() < 0.6;
}

// Создаёт (или возвращает существующий) чат по мэтчу и кладёт первое
// системное сообщение. Возвращает чат.
export async function createMatchChat(
  current: UserProfile,
  activity: Activity,
): Promise<Chat> {
  const id = chatIdFor(current.id, activity.ownerId, activity.id);
  const now = Date.now();
  const title = activityTitle(activity.hobby, activity.date);
  const firstText = `Вы сошлись на активности «${activity.hobby}». Договоритесь о встрече 👋`;

  const chat: Chat = {
    id,
    participants: [current.id, activity.ownerId],
    participantNames: { [current.id]: current.name, [activity.ownerId]: activity.ownerName },
    participantAvatars: {
      [current.id]: current.avatarUrl,
      [activity.ownerId]: activity.ownerAvatar,
    },
    activityId: activity.id,
    activityTitle: title,
    activityOwnerId: activity.ownerId,
    activityHobby: activity.hobby,
    activityPhoto: activity.photoUrl,
    lastMessage: firstText,
    lastMessageAt: now,
    lastSenderId: 'system',
    requestStatus: 'pending',
    readAt: {},
  };

  if (IS_FIREBASE_CONFIGURED && db) {
    await setDoc(doc(db, 'chats', id), chat, { merge: true });
    await setDoc(doc(db, 'matches', id), {
      users: chat.participants,
      activityId: activity.id,
      createdAt: now,
    });
    await addDoc(collection(db, 'chats', id, 'messages'), {
      text: firstText,
      senderId: 'system',
      createdAt: now,
    });
  } else {
    if (!localChats.find((c) => c.id === id)) localChats.unshift(chat);
    localMessages[id] = localMessages[id] ?? [];
    localMessages[id].push({ id: uid('msg'), text: firstText, senderId: 'system', createdAt: now });
    emitChats();
    emitMessages(id);
  }
  return chat;
}

// Демо-чат, чтобы вкладка «Чаты» не была пустой в локальном режиме.
function seedDemoChat(current: UserProfile) {
  if (demoChatSeeded || IS_FIREBASE_CONFIGURED) return;
  demoChatSeeded = true;
  const other = mockUsers[3]; // Екатерина
  const id = chatIdFor(current.id, other.id, 'demo');
  const t0 = Date.now() - 1000 * 60 * 30;
  const chat: Chat = {
    id,
    participants: [current.id, other.id],
    participantNames: { [current.id]: current.name, [other.id]: other.name },
    participantAvatars: { [current.id]: current.avatarUrl, [other.id]: other.avatarUrl },
    activityId: 'demo',
    activityTitle: 'Танцы · Сальса для начинающих',
    activityOwnerId: other.id,
    activityHobby: 'Танцы',
    activityPhoto: '',
    lastMessage: 'Привет! Идёшь завтра на сальсу?',
    lastMessageAt: t0,
    lastSenderId: other.id,
    requestStatus: 'pending',
    readAt: {},
  };
  localChats.unshift(chat);
  localMessages[id] = [
    { id: uid('msg'), text: 'Привет! Увидела твой профиль 🙂', senderId: other.id, createdAt: t0 - 60000 },
    { id: uid('msg'), text: 'Привет! Идёшь завтра на сальсу?', senderId: other.id, createdAt: t0 },
  ];
}

export function subscribeChats(
  current: UserProfile,
  cb: (chats: Chat[]) => void,
): () => void {
  if (IS_FIREBASE_CONFIGURED && db) {
    // ВАЖНО: array-contains + orderBy(другое поле) требует составного индекса,
    // которого может не быть → подписка молча падает, и собеседник «не получает»
    // чаты. Поэтому сортируем на клиенте, без orderBy в запросе.
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', current.id),
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as object) }) as Chat)
          .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        cb(list);
      },
      (err) => console.warn('[subscribeChats] onSnapshot error:', err),
    );
  }

  seedDemoChat(current);
  const deliver = () => {
    const list = localChats
      .filter((c) => c.participants.includes(current.id))
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    cb([...list]);
  };
  chatListeners.add(deliver);
  deliver();
  return () => chatListeners.delete(deliver);
}

export function subscribeMessages(
  chatId: string,
  cb: (messages: ChatMessage[]) => void,
): () => void {
  if (IS_FIREBASE_CONFIGURED && db) {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
    );
    return onSnapshot(
      q,
      (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as ChatMessage));
      },
      (err) => console.warn('[subscribeMessages] onSnapshot error:', err),
    );
  }

  if (!messageListeners[chatId]) messageListeners[chatId] = new Set();
  const deliver = () => cb([...(localMessages[chatId] ?? [])]);
  messageListeners[chatId].add(deliver);
  deliver();
  return () => messageListeners[chatId]?.delete(deliver);
}

export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const now = Date.now();

  if (IS_FIREBASE_CONFIGURED && db) {
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: trimmed,
      senderId,
      createdAt: now,
    });
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: trimmed,
      lastMessageAt: now,
      lastSenderId: senderId,
    });
    return;
  }

  localMessages[chatId] = localMessages[chatId] ?? [];
  localMessages[chatId].push({ id: uid('msg'), text: trimmed, senderId, createdAt: now });
  const chat = localChats.find((c) => c.id === chatId);
  if (chat) {
    chat.lastMessage = trimmed;
    chat.lastMessageAt = now;
    chat.lastSenderId = senderId;
  }
  emitMessages(chatId);
  emitChats();
}

// ─────────────────── Заявки на участие: принять / отказать ──────────────────

// Доставка одного чата в реальном времени (для экрана диалога).
export function subscribeChat(chatId: string, cb: (chat: Chat | null) => void): () => void {
  if (IS_FIREBASE_CONFIGURED && db) {
    return onSnapshot(
      doc(db, 'chats', chatId),
      (snap) => {
        cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as Chat) : null);
      },
      (err) => console.warn('[subscribeChat] onSnapshot error:', err),
    );
  }
  const deliver = () => cb(localChats.find((c) => c.id === chatId) ?? null);
  chatListeners.add(deliver);
  deliver();
  return () => chatListeners.delete(deliver);
}

async function getChatRaw(chatId: string): Promise<Chat | null> {
  if (IS_FIREBASE_CONFIGURED && db) {
    const snap = await getDoc(doc(db, 'chats', chatId));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as object) } as Chat) : null;
  }
  return localChats.find((c) => c.id === chatId) ?? null;
}

async function setRequestStatus(chatId: string, status: Chat['requestStatus']): Promise<void> {
  if (IS_FIREBASE_CONFIGURED && db) {
    await updateDoc(doc(db, 'chats', chatId), { requestStatus: status });
    return;
  }
  const chat = localChats.find((c) => c.id === chatId);
  if (chat) {
    chat.requestStatus = status;
    emitChats();
  }
}

// Системное сообщение в чат (без конкретного отправителя).
async function pushSystemMessage(chatId: string, text: string): Promise<void> {
  const now = Date.now();
  if (IS_FIREBASE_CONFIGURED && db) {
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text,
      senderId: 'system',
      createdAt: now,
    });
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastMessageAt: now,
      lastSenderId: 'system',
    });
    return;
  }
  localMessages[chatId] = localMessages[chatId] ?? [];
  localMessages[chatId].push({ id: uid('msg'), text, senderId: 'system', createdAt: now });
  const chat = localChats.find((c) => c.id === chatId);
  if (chat) {
    chat.lastMessage = text;
    chat.lastMessageAt = now;
    chat.lastSenderId = 'system';
  }
  emitMessages(chatId);
  emitChats();
}

// Отмечает чат прочитанным текущим пользователем (сбрасывает бейдж непрочитанных).
export async function markChatRead(chatId: string, userId: string): Promise<void> {
  const now = Date.now();
  if (IS_FIREBASE_CONFIGURED && db) {
    await updateDoc(doc(db, 'chats', chatId), { [`readAt.${userId}`]: now });
    return;
  }
  const chat = localChats.find((c) => c.id === chatId);
  if (chat) {
    chat.readAt = { ...(chat.readAt ?? {}), [userId]: now };
    emitChats();
  }
}

// Принять собеседника на активность: занимаем одно место.
// Возвращает full=true, если после этого мест не осталось.
export async function acceptJoinRequest(
  chatId: string,
): Promise<{ ok: boolean; full: boolean; reason?: 'no-chat' | 'full' }> {
  const chat = await getChatRaw(chatId);
  if (!chat) return { ok: false, full: false, reason: 'no-chat' };
  if (chat.requestStatus === 'accepted') return { ok: true, full: false };

  const joinerId = chat.participants.find((p) => p !== chat.activityOwnerId) ?? '';
  const joinerName = chat.participantNames[joinerId] ?? 'Участник';

  const activity = await getActivityById(chat.activityId);
  if (!activity) {
    // Демо/без реальной активности — просто фиксируем статус.
    await setRequestStatus(chatId, 'accepted');
    await pushSystemMessage(chatId, `🎉 ${joinerName} принят(а) на активность!`);
    return { ok: true, full: false };
  }
  if (activity.takenSpots >= activity.totalSpots) {
    return { ok: false, full: true, reason: 'full' };
  }

  const newTaken = activity.takenSpots + 1;
  await updateActivity(activity.id, { takenSpots: newTaken });
  await setRequestStatus(chatId, 'accepted');
  await pushSystemMessage(
    chatId,
    `🎉 ${joinerName} принят(а) на активность «${chat.activityHobby}»! До встречи.`,
  );
  return { ok: true, full: newTaken >= activity.totalSpots };
}

// Отказать собеседнику: мягкое автосообщение в чат.
export async function declineJoinRequest(chatId: string): Promise<void> {
  const chat = await getChatRaw(chatId);
  if (!chat) return;
  await setRequestStatus(chatId, 'declined');
  const ownerName = chat.participantNames[chat.activityOwnerId] ?? 'Организатор';
  await pushSystemMessage(
    chatId,
    `${ownerName} пока не смог принять вас на «${chat.activityHobby}» 😔 ` +
      `Не расстраивайтесь — впереди ещё много активностей, обязательно найдётся ваша компания!`,
  );
}
