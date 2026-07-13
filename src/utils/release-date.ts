const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isCanonicalReleaseDate = (value?: string): value is string => {
  if (!value) return false;
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

export const parseReleaseDate = (value?: string, hour = 0) => {
  if (!isCanonicalReleaseDate(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0);
};

export const toLocalDateKey = (value: Date) =>
  [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');

export const shouldCreateReleaseActivity = (
  releaseDate: string | undefined,
  watchlistAddedAt: string | undefined,
  now = new Date()
) => {
  if (!isCanonicalReleaseDate(releaseDate) || !watchlistAddedAt) return false;

  const addedAt = new Date(watchlistAddedAt);
  if (Number.isNaN(addedAt.getTime()) || addedAt.getTime() <= 0) return false;

  return releaseDate <= toLocalDateKey(now) && toLocalDateKey(addedAt) < releaseDate;
};
