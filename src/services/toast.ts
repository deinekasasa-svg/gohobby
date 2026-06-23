// Тонкая обёртка над react-native-toast-message для единых уведомлений.
import Toast from 'react-native-toast-message';

export const notifySuccess = (text2: string, text1 = 'Готово') =>
  Toast.show({ type: 'success', text1, text2, position: 'top' });

export const notifyError = (text2: string, text1 = 'Ошибка') =>
  Toast.show({ type: 'error', text1, text2, position: 'top' });

export const notifyInfo = (text2: string, text1 = '') =>
  Toast.show({ type: 'info', text1, text2, position: 'top' });
