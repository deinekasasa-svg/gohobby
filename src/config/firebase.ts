// Конфигурация Firebase.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ ВАЖНО: замени значения ниже на реальные из Firebase Console               │
// │ (Project settings → General → Your apps → SDK setup and configuration).   │
// │ Пока здесь плейсхолдеры — приложение работает в ЛОКАЛЬНОМ режиме на        │
// │ мок-данных (см. src/data/mockData.ts). Как только впишешь реальный        │
// │ apiKey, приложение автоматически переключится на Firestore + Storage.     │
// └─────────────────────────────────────────────────────────────────────────┘

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
// getReactNativePersistence есть только в RN-сборке firebase — web-типы его не
// знают, поэтому берём через namespace-импорт (Metro подставит RN-реализацию).
import * as firebaseAuth from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCevBKAfx977QA0mwmCVd-9MCu3CVWLjIU',
  authDomain: 'go-hobby.firebaseapp.com',
  projectId: 'go-hobby',
  storageBucket: 'go-hobby.firebasestorage.app',
  messagingSenderId: '678848968863',
  appId: '1:678848968863:web:b53df52b9af310271c0aaa',
  measurementId: 'G-WZV9PL33XK',
};

// Флаг «Firebase реально настроен». Пока apiKey === 'YOUR_API_KEY' —
// весь дата-слой работает на локальных моках, чтобы приложение запускалось
// в Expo Go без бэкенда.
export const IS_FIREBASE_CONFIGURED: boolean =
  !!firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let auth: Auth | null = null;

if (IS_FIREBASE_CONFIGURED) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);

  // Auth с персистентностью через AsyncStorage — структура готова к
  // подключению реальной SMS-аутентификации (см. RegisterScreen).
  try {
    const getRNPersistence = (firebaseAuth as any).getReactNativePersistence;
    auth = initializeAuth(app, {
      persistence: getRNPersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth можно вызвать только один раз — при повторном вызове
    // (hot reload) берём уже созданный инстанс.
    auth = getAuth(app);
  }
}

export { app, db, storage, auth };
