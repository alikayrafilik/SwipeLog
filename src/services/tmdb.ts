import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from '@/i18n/config';

export interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
  vote_average?: number;
  overview?: string;
  genre_ids?: number[];
}

export interface TMDBResponse {
  results: TMDBMovie[];
  page: number;
  total_pages: number;
  total_results: number;
}

interface TMDBGenreResponse {
  genres?: { id: number; name: string }[];
}

export interface WatchProvider {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

export interface WatchProviderData {
  buy?: WatchProvider[];
  flatrate?: WatchProvider[];
  link?: string;
  rent?: WatchProvider[];
}

export interface MovieItem {
  id: string;
  title: string;
  image: string;
  date?: string;
  releaseDate?: string;
  rating?: number;
  overview?: string;
  genreIds?: number[];
  runtimeMinutes?: number;
}

export interface TMDBMovieDetails {
  id: number;
  backdrop_path?: string | null;
  title?: string;
  overview?: string;
  original_language?: string;
  production_countries?: { iso_3166_1: string; name: string }[];
  release_date?: string;
  runtime?: number;
  status?: string;
  tagline?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: { id: number; name: string }[];
  credits?: {
    cast?: {
      id: number;
      name: string;
      profile_path: string | null;
      character?: string;
    }[];
    crew?: {
      id: number;
      name: string;
      profile_path: string | null;
      job?: string;
    }[];
  };
  videos?: {
    results?: {
      id: string;
      key: string;
      name: string;
      official?: boolean;
      site: string;
      type: string;
    }[];
  };
}

export type TrendingWindow = 'day' | 'week';
export type DiscoverFeedMode = 'for_you' | 'trending' | 'hidden_gems' | 'new_releases' | 'nineties';

const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();
let activeTmdbLocale: SupportedLocale = DEFAULT_LOCALE;

export const setTmdbLocale = (locale: SupportedLocale) => {
  activeTmdbLocale = normalizeLocale(locale);
};

const withLanguage = (params: string = '') => {
  const languageParam = `language=${encodeURIComponent(activeTmdbLocale)}`;
  if (!params) return languageParam;
  return params.replace(/language=[^&]*/u, languageParam).includes(languageParam)
    ? params.replace(/language=[^&]*/u, languageParam)
    : `${languageParam}&${params}`;
};

// Helper to format release dates (e.g., 2024-07-26 -> Jul 26, 2024)
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(activeTmdbLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// Map TMDB API items to internal MovieItem models
const mapTMDBMovie = (movie: TMDBMovie): MovieItem => {
  return {
    id: movie.id.toString(),
    title: movie.title,
    image: movie.poster_path 
      ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
      : '',
    date: formatDate(movie.release_date),
    releaseDate: movie.release_date || undefined,
    rating: movie.vote_average ? Math.round((movie.vote_average / 2) * 10) / 10 : 0,
    overview: movie.overview || '',
    genreIds: movie.genre_ids ?? [],
  };
};

const fetchJsonCached = async <T>(
  endpoint: string,
  params: string = '',
  ttlMs = RESPONSE_CACHE_TTL_MS
): Promise<T> => {
  const cacheKey = `${endpoint}?${params}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const pending = pendingRequests.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const request = (async () => {
    const localApiKey = process.env.EXPO_PUBLIC_TMDB_API_KEY;
    const localBaseUrl = process.env.EXPO_PUBLIC_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
    const fetchDirectFromTmdb = async (apiKey: string) => {
      const isV4Token = apiKey.length > 50;
      const queryParams = params ? [params] : [];
      if (!isV4Token) {
        queryParams.push(`api_key=${apiKey}`);
      }
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const tmdbUrl = `${localBaseUrl}${endpoint}${queryString}`;

      const headers: Record<string, string> = {
        accept: 'application/json',
      };
      if (isV4Token) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(tmdbUrl, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
      return data as T;
    };

    if (!localApiKey || localApiKey === 'YOUR_TMDB_API_KEY_HERE') {
      throw new Error('[TMDB] Configure EXPO_PUBLIC_TMDB_API_KEY.');
    }

    return fetchDirectFromTmdb(localApiKey);
  })().finally(() => {
    pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, request);
  return request as Promise<T>;
};

export const tmdbService = {
  async getMovieGenres(): Promise<{ id: number; name: string }[]> {
    try {
      const data = await fetchJsonCached<TMDBGenreResponse>('/genre/movie/list', withLanguage());
      return Array.isArray(data.genres) ? data.genres : [];
    } catch (error) {
      console.error('[TMDB] Error fetching movie genres:', error);
      return [];
    }
  },

  /**
   * Fetch a page of popular discovery candidates from TMDB.
   */
  async discoverMovies(page: number = 1): Promise<MovieItem[]> {
    try {
      const data = await fetchJsonCached<TMDBResponse>(
        '/discover/movie',
        withLanguage(`sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`)
      );
      return Array.isArray(data.results) ? data.results.map(mapTMDBMovie) : [];
    } catch (error) {
      console.error(`[TMDB] Error discovering movies on page ${page}:`, error);
      return [];
    }
  },

  /**
   * Fetch discovery candidates centered on the user's strongest genres.
   */
  async discoverMoviesByGenres(genreIds: number[], page: number = 1, providerId?: number): Promise<MovieItem[]> {
    if (genreIds.length === 0) return [];

    try {
      const genres = encodeURIComponent(
        [...new Set(genreIds)].slice(0, 5).sort((left, right) => left - right).join('|')
      );
      const providerParams = providerId ? `&with_watch_providers=${providerId}&watch_region=TR` : '';
      const data = await fetchJsonCached<TMDBResponse>(
        '/discover/movie',
        withLanguage(`sort_by=vote_count.desc&include_adult=false&include_video=false&vote_count.gte=120&with_genres=${genres}&page=${page}${providerParams}`)
      );
      return Array.isArray(data.results) ? data.results.map(mapTMDBMovie) : [];
    } catch (error) {
      console.error(`[TMDB] Error discovering movies by genre on page ${page}:`, error);
      return [];
    }
  },

  /** Fetch one curated Discover session pool, optionally focused on a genre. */
  async discoverMoviesForMode(
    mode: DiscoverFeedMode,
    page: number = 1,
    genreId?: number,
    providerId?: number
  ): Promise<MovieItem[]> {
    try {
      if (mode === 'trending' && !genreId && !providerId && page === 1) {
        return this.getTrendingMovies('week');
      }

      const today = new Date();
      const releaseStart = new Date(today);
      releaseStart.setDate(releaseStart.getDate() - 150);
      const dateString = (date: Date) => date.toISOString().slice(0, 10);
      const params = [
        'include_adult=false',
        'include_video=false',
        `page=${page}`,
      ];

      if (genreId) params.push(`with_genres=${genreId}`);
      if (providerId) params.push(`with_watch_providers=${providerId}`, 'watch_region=TR');

      if (mode === 'hidden_gems') {
        params.push('sort_by=vote_average.desc', 'vote_count.gte=120', 'vote_count.lte=2500');
      } else if (mode === 'new_releases') {
        params.push(
          'sort_by=popularity.desc',
          `primary_release_date.gte=${dateString(releaseStart)}`,
          `primary_release_date.lte=${dateString(today)}`,
          'vote_count.gte=20'
        );
      } else if (mode === 'nineties') {
        params.push(
          'sort_by=vote_count.desc',
          'primary_release_date.gte=1990-01-01',
          'primary_release_date.lte=1999-12-31',
          'vote_count.gte=100'
        );
      } else {
        params.push(mode === 'trending' ? 'sort_by=popularity.desc' : 'sort_by=vote_count.desc', 'vote_count.gte=80');
      }

      const data = await fetchJsonCached<TMDBResponse>('/discover/movie', withLanguage(params.join('&')));
      return Array.isArray(data.results) ? data.results.map(mapTMDBMovie) : [];
    } catch (error) {
      console.error(`[TMDB] Error fetching ${mode} discovery movies on page ${page}:`, error);
      return [];
    }
  },

  /**
   * Fetch movies trending today or this week from TMDB
   */
  async getTrendingMovies(timeWindow: TrendingWindow = 'week'): Promise<MovieItem[]> {
    try {
      const data = await fetchJsonCached<TMDBResponse>(`/trending/movie/${timeWindow}`, withLanguage());
      return Array.isArray(data.results) ? data.results.map(mapTMDBMovie) : [];
    } catch (error) {
      console.error(`[TMDB] Error fetching ${timeWindow} trending movies:`, error);
      return [];
    }
  },

  /**
   * Fetch TMDB recommendations based on a movie
   */
  async getMovieRecommendations(movieId: string, page: number = 1): Promise<MovieItem[]> {
    if (!movieId) return [];

    try {
      const data = await fetchJsonCached<TMDBResponse>(
        `/movie/${movieId}/recommendations`,
        withLanguage(`page=${page}`)
      );
      return Array.isArray(data.results) ? data.results.map(mapTMDBMovie) : [];
    } catch (error) {
      console.error(`[TMDB] Error fetching recommendations for movie ${movieId}:`, error);
      return [];
    }
  },

  /**
   * Fetch upcoming movies from TMDB
   */
  async getUpcomingMovies(): Promise<MovieItem[]> {
    try {
      const data = await fetchJsonCached<TMDBResponse>('/movie/upcoming', withLanguage('region=TR'));
      if (data && Array.isArray(data.results)) {
        return data.results.map(mapTMDBMovie);
      }
      return [];
    } catch (error) {
      console.error('[TMDB] Error fetching upcoming movies:', error);
      return [];
    }
  },

  /**
   * Fetch movies currently playing in theaters in Turkey
   */
  async getNowPlayingMovies(): Promise<MovieItem[]> {
    try {
      const data = await fetchJsonCached<TMDBResponse>('/movie/now_playing', withLanguage('region=TR'));
      if (data && Array.isArray(data.results)) {
        return data.results.map(mapTMDBMovie);
      }
      return [];
    } catch (error) {
      console.error('[TMDB] Error fetching now playing movies:', error);
      return [];
    }
  },

  /**
   * Fetch top rated movies from TMDB
   */
  async getTopRatedMovies(): Promise<MovieItem[]> {
    try {
      const data = await fetchJsonCached<TMDBResponse>('/movie/top_rated', withLanguage());
      if (data && Array.isArray(data.results)) {
        return data.results.map(mapTMDBMovie);
      }
      return [];
    } catch (error) {
      console.error('[TMDB] Error fetching top rated movies:', error);
      return [];
    }
  },

  /**
   * Search movies by name on TMDB
   */
  async searchMovies(query: string): Promise<MovieItem[]> {
    if (!query.trim()) return [];

    try {
      const encodedQuery = encodeURIComponent(query.trim());
      const data = await fetchJsonCached<TMDBResponse>(
        '/search/movie',
        withLanguage(`query=${encodedQuery}`),
        15 * 60 * 1000
      );
      if (data && Array.isArray(data.results)) {
        return data.results.map(mapTMDBMovie);
      }
      return [];
    } catch (error) {
      console.error(`[TMDB] Error searching movies for "${query}":`, error);
      return [];
    }
  },

  /**
   * Fetch full details for a movie from TMDB
   */
  async getMovieDetails(movieId: string): Promise<TMDBMovieDetails | null> {
    try {
      return await fetchJsonCached<TMDBMovieDetails>(
        `/movie/${movieId}`,
        withLanguage('append_to_response=credits,videos'),
        15 * 60 * 1000
      );
    } catch (error) {
      console.error(`[TMDB] Error fetching details for movie ${movieId}:`, error);
      return null;
    }
  },

  /**
   * Fetch TR watch providers for a movie from TMDB
   */
  async getWatchProviders(movieId: string): Promise<WatchProviderData | null> {
    try {
      const data = await fetchJsonCached<{ results?: Record<string, WatchProviderData> }>(
        `/movie/${movieId}/watch/providers`,
        '',
        15 * 60 * 1000
      );
      return data?.results?.TR || null;
    } catch (error) {
      console.error(`[TMDB] Error fetching watch providers for movie ${movieId}:`, error);
      return null;
    }
  }
};
