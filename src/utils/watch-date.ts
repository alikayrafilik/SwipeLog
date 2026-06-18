const MIN_WATCH_DATE = '1895-12-28';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

export const WATCH_DATE_HELP_TEXT = `Use ${MIN_WATCH_DATE} through today.`;

export const validateWatchDate = (value: string) => {
  const dateKey = value.trim();
  if (!DATE_PATTERN.test(dateKey)) {
    return { dateKey, error: 'Use YYYY-MM-DD format.' };
  }

  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    return { dateKey, error: 'Enter a real calendar date.' };
  }

  if (dateKey < MIN_WATCH_DATE) {
    return { dateKey, error: `Date cannot be before ${MIN_WATCH_DATE}.` };
  }

  const today = getTodayDateKey();
  if (dateKey > today) {
    return { dateKey, error: 'Date cannot be in the future.' };
  }

  return { dateKey, error: null };
};

export const toWatchDateTime = (dateKey: string) => `${dateKey}T12:00:00`;
