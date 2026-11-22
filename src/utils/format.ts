export type TextScale = 'sm' | 'md' | 'lg';

export function formatFrenchRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMin < 2) {
    return "À l'instant";
  }
  if (diffMin < 60) {
    return `Il y a ${diffMin} min`;
  }
  if (diffHours < 24) {
    return `Il y a ${diffHours} h`;
  }

  // Check if yesterday in local time
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Hier';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatReadingTime(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  return `${minutes} min de lecture`;
}

export function isSafeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function getSourceInitials(source: string): string {
  const words = source
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => !['le', 'la', 'les', 'de', 'des', 'du'].includes(w.toLowerCase()));
  if (words.length === 0) return 'CL';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
