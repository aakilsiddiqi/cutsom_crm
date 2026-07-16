const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
});

export const formatDate = (dateString: string): string => {
  return dateFormatter.format(new Date(dateString));
};

export const formatShortDate = (date: Date): string => {
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `${formatShortDate(date)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

export const timeAgo = (dateString: string): string => {
  const diffMs = new Date().getTime() - new Date(dateString).getTime();
  const mins = Math.round(diffMs / 60000);
  const hrs = Math.round(mins / 60);
  const days = Math.round(hrs / 24);
  if (mins < 60) return `${mins} mins ago`;
  if (hrs < 24) return `${hrs} hours ago`;
  return `${days} days ago`;
};

export const formatTAT = (hours: number): string => {
  if (hours < 1) return `${Math.round(hours * 60)} mins`;
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `${days} days ${remainingHours} hrs`;
};

export const convertToISO = (dateStr: string): string | null => {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return null;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const parseDateString = (dStr: string, isEnd: boolean): string | null => {
  const parts = dStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (isEnd) date.setHours(23, 59, 59, 999);
    return date.toISOString();
  }
  return null;
};
