// Форматирование даты/времени встречи в человекочитаемый русский вид.
import { format, isToday, isTomorrow } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Activity } from '../types';

// «Сегодня в 19:00» / «Завтра в 19:00» / «24 июня в 19:00»
export function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Сегодня в ${time}`;
  if (isTomorrow(d)) return `Завтра в ${time}`;
  return `${format(d, 'd MMMM', { locale: ru })} в ${time}`;
}

// «1 января в 19:00 — 21:00 (2 часа)» или «1 января 19:00 — 3 января 19:00 (2 дня)»
export function formatDateRange(startIso: string, endIso?: string): string {
  const s = new Date(startIso);
  if (Number.isNaN(s.getTime())) return '';

  const dayLabel = isToday(s) ? 'Сегодня' : isTomorrow(s) ? 'Завтра' : format(s, 'd MMMM', { locale: ru });
  const timeS = format(s, 'HH:mm');

  if (!endIso) return `${dayLabel} в ${timeS}`;

  const e = new Date(endIso);
  if (Number.isNaN(e.getTime())) return `${dayLabel} в ${timeS}`;

  const timeE = format(e, 'HH:mm');
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  if (sameDay) {
    const diffMs = e.getTime() - s.getTime();
    const diffH = Math.round(diffMs / 36e5);
    const duration = diffH > 0 ? ` (${diffH} ${diffH === 1 ? 'час' : diffH < 5 ? 'часа' : 'часов'})` : '';
    return `${dayLabel} в ${timeS} — ${timeE}${duration}`;
  }

  const diffDays = Math.round((e.getTime() - s.getTime()) / 864e5);
  const dayWord = diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней';
  const endLabel = isToday(e) ? 'Сегодня' : isTomorrow(e) ? 'Завтра' : format(e, 'd MMMM', { locale: ru });
  return `${dayLabel} ${timeS} — ${endLabel} ${timeE} (${diffDays} ${dayWord})`;
}

// Короткая подпись для чата/мэтча: «Теннис · Завтра в 19:00»
export function activityTitle(hobby: string, iso: string): string {
  return `${hobby} · ${formatActivityDate(iso)}`;
}

// «в 14:32» — для времени последнего сообщения в списке чатов.
export function formatTime(ts: number): string {
  return format(new Date(ts), 'HH:mm');
}

// Разбивка активностей на предстоящие (по возрастанию даты) и прошедшие (по убыванию).
export function splitUpcomingPast(acts: Activity[]): {
  upcoming: Activity[];
  past: Activity[];
} {
  const now = Date.now();
  const ts = (a: Activity) => new Date(a.date).getTime();
  const upcoming = acts.filter((a) => ts(a) >= now).sort((a, b) => ts(a) - ts(b));
  const past = acts.filter((a) => ts(a) < now).sort((a, b) => ts(b) - ts(a));
  return { upcoming, past };
}
