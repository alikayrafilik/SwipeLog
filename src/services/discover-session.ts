import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersonalizedCandidate } from '@/services/discovery-ranking';

export type DiscoverMode = 'for_you' | 'trending' | 'hidden_gems' | 'new_releases' | 'nineties';
export type DiscoverTriageBucket = 'interested' | 'passed' | 'watched';

export interface PersistedDiscoverTriageItem {
  movie: PersonalizedCandidate;
  bucket: DiscoverTriageBucket;
  createdAt: string;
}

export interface PersistedWatchedDraft {
  movieId: string;
  rating: number;
  note: string;
  watchedAt: string;
  isFavorite: boolean;
}

export interface PersistedDiscoverSession {
  version: 1;
  mode: DiscoverMode;
  genreId: number | null;
  triage: PersistedDiscoverTriageItem[];
  watchedDrafts: Record<string, PersistedWatchedDraft>;
  deck: PersonalizedCandidate[];
  page: number;
  sessionTotal: number;
  locale: string;
  hasActiveSession: boolean;
}

export const DISCOVER_SESSION_SIZE = 20;
export const DISCOVER_GENRE_FOCUS_COUNT = 15;

export const DISCOVER_MODES: DiscoverMode[] = [
  'for_you',
  'trending',
  'hidden_gems',
  'new_releases',
  'nineties',
];

export const DISCOVER_GENRES = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 27, name: 'Horror' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
] as const;

const STORAGE_KEY = '@swipelog_discover_session_v1';

const emptySession = (): PersistedDiscoverSession => ({
  version: 1,
  mode: 'for_you',
  genreId: null,
  triage: [],
  watchedDrafts: {},
  deck: [],
  page: 1,
  sessionTotal: 0,
  locale: '',
  hasActiveSession: false,
});

export const loadDiscoverSession = async (): Promise<PersistedDiscoverSession> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return emptySession();
    const parsed = JSON.parse(stored) as Partial<PersistedDiscoverSession>;
    return {
      version: 1,
      mode: DISCOVER_MODES.includes(parsed.mode as DiscoverMode) ? parsed.mode as DiscoverMode : 'for_you',
      genreId: typeof parsed.genreId === 'number' ? parsed.genreId : null,
      triage: Array.isArray(parsed.triage) ? parsed.triage : [],
      watchedDrafts: parsed.watchedDrafts && typeof parsed.watchedDrafts === 'object' ? parsed.watchedDrafts : {},
      deck: Array.isArray(parsed.deck) ? parsed.deck : [],
      page: typeof parsed.page === 'number' && parsed.page > 0 ? parsed.page : 1,
      sessionTotal: typeof parsed.sessionTotal === 'number' ? parsed.sessionTotal : 0,
      locale: typeof parsed.locale === 'string' ? parsed.locale : '',
      hasActiveSession: parsed.hasActiveSession === true,
    };
  } catch (error) {
    console.warn('[Discover] Could not restore session:', error);
    return emptySession();
  }
};

export const saveDiscoverSession = async (session: PersistedDiscoverSession) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn('[Discover] Could not persist session:', error);
  }
};

export const clearDiscoverSession = () => AsyncStorage.removeItem(STORAGE_KEY);

export const mixDiscoverSession = <T extends { id: string }>(focused: T[], surprises: T[]): T[] => {
  const uniqueFocused = Array.from(new Map(focused.map((movie) => [movie.id, movie])).values());
  const focusedIds = new Set(uniqueFocused.map((movie) => movie.id));
  const uniqueSurprises = Array.from(
    new Map(surprises.filter((movie) => !focusedIds.has(movie.id)).map((movie) => [movie.id, movie])).values()
  );
  const focusSlice = uniqueFocused.slice(0, DISCOVER_GENRE_FOCUS_COUNT);
  const surpriseSlice = uniqueSurprises.slice(0, DISCOVER_SESSION_SIZE - focusSlice.length);
  const result: T[] = [];

  focusSlice.forEach((movie, index) => {
    result.push(movie);
    if ((index + 1) % 3 === 0 && surpriseSlice.length > 0) {
      const surprise = surpriseSlice.shift();
      if (surprise) result.push(surprise);
    }
  });

  return [...result, ...surpriseSlice].slice(0, DISCOVER_SESSION_SIZE);
};
