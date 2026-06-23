// Общие типы данных GoHobby. Используются и в моках, и в Firestore-слое.

export interface GeoPoint {
  lat: number;
  lng: number;
}

// Личность из Telegram, подтверждённая ботом (см. Cloud Function).
export interface TelegramIdentity {
  id: string; // telegram user id
  firstName: string;
  lastName: string;
  username: string; // @username (может быть пустым)
}

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  city: string;
  telegramId?: string; // id аккаунта Telegram (если вход через Telegram)
  telegramUsername?: string;
  birthDate: string | null; // ISO-строка даты рождения
  hobbies: string[];
  bio?: string; // «коротко о себе», до 500 символов (необязательно)
  avatarUrl: string;
  rating: number; // 1..5, пока статично
  location: GeoPoint | null; // null если пользователь отказал в геолокации
}

export interface Activity {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  ownerRating: number;
  ownerAge: number | null;
  ownerCity: string; // город активности (выбирается при создании, может отличаться от города владельца)
  ownerLocation: GeoPoint | null; // координаты города активности (центр выбранного города)
  hobby: string;
  photoUrl: string;
  date: string;    // ISO дата+время начала
  endDate?: string; // ISO дата+время конца (опционально)
  place: string;
  description: string;
  totalSpots: number; // всего мест
  takenSpots: number; // занято мест
  createdAt: number; // timestamp создания (для сортировки)
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  createdAt: number;
}

export interface Chat {
  id: string;
  participants: string[]; // id участников
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  activityId: string;
  activityTitle: string; // например «Теннис · Завтра в 19:00»
  activityOwnerId: string; // владелец активности (только он видит «Принять/Отказать»)
  activityHobby: string;
  activityPhoto: string;
  lastMessage: string;
  lastMessageAt: number;
  lastSenderId: string; // кто отправил последнее сообщение (для бейджа непрочитанных)
  requestStatus: 'pending' | 'accepted' | 'declined'; // статус заявки на участие
  readAt?: Record<string, number>; // когда участник последний раз открывал чат
}
