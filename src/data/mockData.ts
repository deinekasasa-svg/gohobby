// Мок-данные GoHobby.
// При первом запуске приложение НЕ пустое: эти пользователи и активности
// либо заливаются в Firestore через seedFirestore() (если он настроен),
// либо используются локально как фолбэк (см. src/services/data.ts).

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, IS_FIREBASE_CONFIGURED } from '../config/firebase';
import type { Activity, GeoPoint, UserProfile } from '../types';

function calcAge(birthDate: string): number {
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

// Хелпер: дата на N дней вперёд в указанное время → ISO-строка.
function at(daysAhead: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const avatar = (n: number) => `https://i.pravatar.cc/300?img=${n}`;
const photo = (seed: string) => `https://picsum.photos/seed/${seed}/800/1000`;

// Примерные координаты районов Москвы и СПб для мок-данных
const moscowLocations: GeoPoint[] = [
  { lat: 55.7558, lng: 37.6173 }, // центр
  { lat: 55.7312, lng: 37.5817 }, // Ленинский
  { lat: 55.7887, lng: 37.5953 }, // Ходынка
  { lat: 55.7522, lng: 37.6854 }, // Таганка
  { lat: 55.7200, lng: 37.6400 }, // Люблино
  { lat: 55.8100, lng: 37.5600 }, // Сокол
];
const spbLocations: GeoPoint[] = [
  { lat: 59.9311, lng: 30.3609 }, // центр
  { lat: 59.9500, lng: 30.3200 }, // Петроградка
];
const kazanLocation: GeoPoint = { lat: 55.7960, lng: 49.1064 };

export const mockUsers: UserProfile[] = [
  { id: 'u1', phone: '+79990000001', name: 'Алексей', city: 'Москва', birthDate: '1994-05-12', hobbies: ['Теннис', 'Бег'], bio: 'Играю в теннис по выходным, ищу партнёров для парных матчей и утренних пробежек по набережной.', avatarUrl: avatar(11), rating: 5, location: moscowLocations[0] },
  { id: 'u2', phone: '+79990000002', name: 'Марина', city: 'Москва', birthDate: '1996-09-03', hobbies: ['Йога', 'Походы'], bio: 'Инструктор по йоге. Люблю выбираться в горы и знакомиться с новыми людьми в дороге.', avatarUrl: avatar(45), rating: 4, location: moscowLocations[1] },
  { id: 'u3', phone: '+79990000003', name: 'Дмитрий', city: 'Санкт-Петербург', birthDate: '1990-01-22', hobbies: ['Настолки', 'Шахматы'], avatarUrl: avatar(13), rating: 5, location: spbLocations[0] },
  { id: 'u4', phone: '+79990000004', name: 'Екатерина', city: 'Москва', birthDate: '1998-11-30', hobbies: ['Танцы', 'Музыка'], bio: 'Танцую сальсу и бачату. Зову всех на вечеринки и open-air концерты!', avatarUrl: avatar(47), rating: 4, location: moscowLocations[2] },
  { id: 'u5', phone: '+79990000005', name: 'Игорь', city: 'Казань', birthDate: '1992-07-18', hobbies: ['Эндуро', 'Походы'], avatarUrl: avatar(15), rating: 5, location: kazanLocation },
  { id: 'u6', phone: '+79990000006', name: 'Ольга', city: 'Москва', birthDate: '1995-03-08', hobbies: ['Фотография', 'Рисование'], avatarUrl: avatar(49), rating: 4, location: moscowLocations[3] },
  { id: 'u7', phone: '+79990000007', name: 'Павел', city: 'Москва', birthDate: '1989-12-01', hobbies: ['Падел', 'Сквош'], avatarUrl: avatar(17), rating: 5, location: moscowLocations[4] },
  { id: 'u8', phone: '+79990000008', name: 'Анна', city: 'Санкт-Петербург', birthDate: '1997-06-25', hobbies: ['Волейбол', 'Бег'], avatarUrl: avatar(31), rating: 4, location: spbLocations[1] },
  { id: 'u9', phone: '+79990000009', name: 'Сергей', city: 'Москва', birthDate: '1993-02-14', hobbies: ['Шахматы', 'Настолки'], avatarUrl: avatar(19), rating: 5, location: moscowLocations[5] },
  { id: 'u10', phone: '+79990000010', name: 'Юлия', city: 'Москва', birthDate: '1999-08-09', hobbies: ['Йога', 'Танцы'], avatarUrl: avatar(48), rating: 5, location: moscowLocations[0] },
];

const usersById = Object.fromEntries(mockUsers.map((u) => [u.id, u]));

function activityOf(
  id: string,
  ownerId: string,
  hobby: string,
  seed: string,
  date: string,
  place: string,
  description: string,
  totalSpots: number,
  takenSpots: number,
): Activity {
  const owner = usersById[ownerId];
  return {
    id,
    ownerId,
    ownerName: owner.name,
    ownerAvatar: owner.avatarUrl,
    ownerRating: owner.rating,
    ownerAge: owner.birthDate ? calcAge(owner.birthDate) : null,
    ownerCity: owner.city,
    ownerLocation: owner.location ?? null,
    hobby,
    photoUrl: photo(seed),
    date,
    place,
    description,
    totalSpots,
    takenSpots,
    createdAt: Date.now(),
  };
}

export const mockActivities: Activity[] = [
  activityOf('a1', 'u1', 'Теннис', 'tennis', at(1, 19, 0), 'Корт на Ленинском, 45', 'Ищу партнёра на парную игру. Уровень — любитель.', 2, 1),
  activityOf('a2', 'u7', 'Падел', 'padel', at(1, 11, 30), 'Padel Friends, ул. Усачёва, 2', 'Собираем четвёрку на падел. Есть ракетки в аренду.', 4, 2),
  activityOf('a3', 'u5', 'Эндуро', 'enduro', at(2, 9, 0), 'Сбор у заправки на Новой Риге', 'Прохват по грунтам на полдня. Нужна экипировка.', 5, 3),
  activityOf('a4', 'u3', 'Настолки', 'boardgames', at(0, 20, 0), 'Антикафе «Кубик», Тверская', 'Вечер настолок: Каркассон, Манчкин, Codenames.', 6, 4),
  activityOf('a5', 'u8', 'Бег', 'running', at(1, 8, 0), 'Парк Горького, главный вход', 'Лёгкая пробежка 5 км в комфортном темпе.', 8, 3),
  activityOf('a6', 'u2', 'Походы', 'hiking', at(3, 7, 30), 'Ж/д станция Турист', 'Однодневный поход к Долине реки. Ⓢ 12 км.', 6, 2),
  activityOf('a7', 'u4', 'Танцы', 'dance', at(2, 19, 30), 'Студия «Movement», Цветной б-р', 'Сальса для начинающих. Партнёр приветствуется.', 10, 6),
  activityOf('a8', 'u6', 'Фотография', 'photo', at(1, 17, 0), 'Парк Зарядье', 'Фотопрогулка на закате. Берём камеры/телефоны.', 4, 1),
  activityOf('a9', 'u9', 'Шахматы', 'chess', at(0, 18, 0), 'Шахматный клуб на Гоголевском', 'Блиц-турнир по швейцарке. Любой уровень.', 8, 5),
  activityOf('a10', 'u10', 'Йога', 'yoga', at(2, 9, 30), 'Студия «Прана», Чистые пруды', 'Утренняя хатха-йога. Коврики есть на месте.', 12, 7),
];

// Заливка моков в Firestore, если коллекция activities пуста.
// В локальном режиме (Firebase не настроен) — тихо ничего не делает.
export async function seedFirestore(): Promise<void> {
  if (!IS_FIREBASE_CONFIGURED || !db) return;

  try {
    const snapshot = await getDocs(collection(db, 'activities'));
    if (!snapshot.empty) return; // уже засеяно

    const batch = writeBatch(db);
    mockUsers.forEach((u) => batch.set(doc(db!, 'users', u.id), u));
    mockActivities.forEach((a) => batch.set(doc(db!, 'activities', a.id), a));
    await batch.commit();
    // eslint-disable-next-line no-console
    console.log('[seedFirestore] Мок-данные залиты в Firestore');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[seedFirestore] Не удалось засеять Firestore:', e);
  }
}
