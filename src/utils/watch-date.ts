const MIN_WATCH_DATE_KEY = '1950-01-01';
const MIN_WATCH_DATE_INPUT = '01-01-1950';

const INPUT_DATE_PATTERN = /^\d{2}-\d{2}-\d{4}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toInputDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-');
  return `${day}-${month}-${year}`;
};

export const getTodayDateKey = () => new Date().toISOString().slice(0, 10);

export const getTodayWatchDateInput = () => toInputDate(getTodayDateKey());

export const WATCH_DATE_HELP_TEXT = `Use ${MIN_WATCH_DATE_INPUT} through today.`;

export const validateIsoWatchDate = (value: string) => {
  const dateKey = value.trim();
  if (!ISO_DATE_PATTERN.test(dateKey)) {
    return { dateKey, error: 'Use YYYY-MM-DD format.' };
  }

  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    return { dateKey, error: 'Enter a real calendar date.' };
  }

  if (dateKey < MIN_WATCH_DATE_KEY) {
    return { dateKey, error: `Date cannot be before ${MIN_WATCH_DATE_INPUT}.` };
  }

  if (dateKey > getTodayDateKey()) {
    return { dateKey, error: 'Date cannot be in the future.' };
  }

  return { dateKey, error: null };
};

export const validateWatchDate = (value: string) => {
  const dateInput = value.trim();
  if (!INPUT_DATE_PATTERN.test(dateInput)) {
    return { dateInput, dateKey: '', error: 'Use DD-MM-YYYY format.' };
  }

  const [day, month, year] = dateInput.split('-');
  const dateKey = `${year}-${month}-${day}`;
  const validation = validateIsoWatchDate(dateKey);

  return {
    dateInput,
    dateKey,
    error: validation.error?.replace('YYYY-MM-DD', 'DD-MM-YYYY') ?? null,
  };
};

export const toWatchDateInput = (value: string) => toInputDate(value.slice(0, 10));

export const toWatchDateTime = (dateKey: string) => `${dateKey}T12:00:00`;
