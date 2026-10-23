export const dayLabel = (day: number) => {
  const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return labels[day] ?? `Day ${day}`;
};

// The API returns naive UTC timestamps such as "2026-10-23 10:47:51.322763".
// Treat strings without a timezone as UTC so they display in local time.
export const parseServerDate = (dateString: string) => {
  let normalized = dateString.trim().replace(' ', 'T');
  normalized = normalized.replace(/(\.\d{3})\d+/, '$1');
  if (/T\d{2}:\d{2}/.test(normalized) && !/(Z|[+-]\d{2}:?\d{2})$/.test(normalized)) {
    normalized += 'Z';
  }
  return new Date(normalized);
};

export const toLocalDateTime = (dateString: string) => {
  const date = parseServerDate(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleString();
};

export const toLocalDate = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString();
};

export const toLocalTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const relativeDayLabel = (date: Date, now = new Date()) => {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};
