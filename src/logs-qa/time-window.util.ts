import type { TimeWindow } from './query-plan.types';

export function resolveTimeRange(
  timeWindow: TimeWindow,
  now = new Date(),
): { since: Date; until: Date } {
  const until = now;

  if (timeWindow.calendarDay && timeWindow.unit === 'day') {
    const since = new Date(until);
    since.setHours(0, 0, 0, 0);
    return { since, until };
  }

  const since = new Date(until);
  const n = Math.max(1, timeWindow.amount);

  switch (timeWindow.unit) {
    case 'minute':
      since.setMinutes(since.getMinutes() - n);
      break;
    case 'hour':
      since.setHours(since.getHours() - n);
      break;
    case 'day':
      since.setDate(since.getDate() - n);
      break;
  }

  return { since, until };
}

export function defaultTimeWindow(question: string): TimeWindow {
  const q = question.toLowerCase();

  if (/hoje|today/i.test(q)) {
    return { amount: 1, unit: 'day', calendarDay: true };
  }
  if (/último\s+minuto|ultimo\s+minuto|last\s+minute/i.test(q)) {
    return { amount: 1, unit: 'minute' };
  }
  if (/última\s+hora|ultima\s+hora|last\s+hour/i.test(q)) {
    return { amount: 1, unit: 'hour' };
  }
  if (/último\s+dia|ultimo\s+dia|last\s+day/i.test(q)) {
    return { amount: 1, unit: 'day' };
  }

  const minutesMatch = q.match(/últimos?\s+(\d+)\s+minutos?|ultimos?\s+(\d+)\s+minutos?/i);
  if (minutesMatch) {
    return { amount: parseInt(minutesMatch[1] ?? minutesMatch[2], 10), unit: 'minute' };
  }

  const hoursMatch = q.match(/últimas?\s+(\d+)\s+horas?|ultimas?\s+(\d+)\s+horas?/i);
  if (hoursMatch) {
    return { amount: parseInt(hoursMatch[1] ?? hoursMatch[2], 10), unit: 'hour' };
  }

  return { amount: 1, unit: 'hour' };
}
