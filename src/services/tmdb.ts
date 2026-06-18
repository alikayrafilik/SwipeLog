import { supabase } from '@/services/supabase';

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
  rating?: number;
  overview?: string;
  genreIds?: number[];
  runtimeMinutes?: number;
}

export type TrendingWindow = 'day' | 'week';

const RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; data: unknown }>();
const pendingRequests = new Map<string, Promise<unknown>>();

const FALLBACK_MOVIES: MovieItem[] = [
  {
    id: 'fallback-interstellar',
    title: 'Interstellar',
    image: '',
    date: '2014',
    rating: 4.4,
    overview:
      'In a dystopian future where Earth has become near-uninhabitable, a team of astronauts embark on a mission to find a new home for humanity.',
  },
  {
    id: 'fallback-person-of-interest',
    title: 'Person of Interest',
    image: '',
    date: '2011',
    rating: 4.2,
    overview:
      'An off-the-grid former CIA agent is hired by a mysterious tech billionaire to prevent violent crimes before they happen.',
  },
  {
    id: 'fallback-winters-bone',
    title: "Winter's Bone",
    image: '',
    date: '2010',
    rating: 3.8,
    overview:
      'An unflinching Ozark Mountain girl hacks through dangerous social terrain as she searches for her missing father.',
  },
  {
    id: 'fallback-interstellar-odyssey',
    title: "Inside 'Interstellar': Nolan's Odyssey",
    image: '',
    date: '2014',
    rating: 3.7,
    overview: "A look behind the lens of Christopher Nolan's space epic.",
  },
  {
    id: 'fallback-science-of-interstellar',
    title: 'The Science of Interstellar',
    image: '',
    date: '2014',
    rating: 3.9,
    overview: "Matthew McConaughey narrates a fascinating look at Christopher Nolan's sci-fi film.",
  },
  {
    id: 'fallback-lolita-interstellar',
    title: 'Lolita from Interstellar Space',
    image: '',
    date: '2014',
    rating: 2.6,
    overview: 'An undeniably beautiful alien is sent to Earth to study the complex mating rituals of humankind.',
  },
  {
    id: 'fallback-inside-interstellar',
    title: "Inside 'Interstellar'",
    image: '',
    date: '2015',
    rating: 3.5,
    overview: "Cast and crew of Christopher Nolan's Interstellar discuss project origins, science, and production.",
  },
  {
    id: 'fallback-interstellar-wars',
    title: 'Interstellar Wars',
    image: '',
    date: '2016',
    rating: 2.2,
    overview: 'A team travels beyond Earth to face a conflict that stretches across distant worlds.',
  },
];

const getFallbackMovies = (query: string): MovieItem[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const matches = FALLBACK_MOVIES.filter((movie) =>
    `${movie.title} ${movie.overview}`.toLowerCase().includes(normalizedQuery)
  );

  return matches.length > 0 ? matches : FALLBACK_MOVIES.slice(0, 3);
};

// Helper to format release dates (e.g., 2024-07-26 -> Jul 26, 2024)
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
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

    // In local development, bypass the Edge Function if a local TMDB API key is present
    if (__DEV__ && localApiKey && localApiKey !== 'YOUR_TMDB_API_KEY_HERE') {
      const isV4Token = localApiKey.length > 50;
      const queryParams = params ? [params] : [];
      if (!isV4Token) {
        queryParams.push(`api_key=${localApiKey}`);
      }
      const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
      const tmdbUrl = `${localBaseUrl}${endpoint}${queryString}`;

      const headers: Record<string, string> = {
        accept: 'application/json',
      };
      if (isV4Token) {
        headers['Authorization'] = `Bearer ${localApiKey}`;
      }

      const response = await fetch(tmdbUrl, { method: 'GET', headers });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
      return data as T;
    }

    // Otherwise, use the deployed Supabase Edge Function proxy
    const { data, error } = await supabase.functions.invoke('tmdb-proxy', {
      body: { endpoint, params },
    });
    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }
    responseCache.set(cacheKey, { data, expiresAt: Date.now() + ttlMs });
    return data as T;
  })().finally(() => {
    pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, request);
  return request as Promise<T>;
};

export const tmdbService = {
  /**
   * Fetch a page of popular discovery candidates from TMDB.
   */
  async discoverMovies(page: number = 1): Promise<MovieItem[]> {
    try {
      const data = await fetchJsonCached<TMDBResponse>(
        '/discover/movie',
        `language=en-US&sort_by=popularity.desc&include_adult=false&include_video=false&page=${page}`
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
  async discoverMoviesByGenres(genreIds: number[], page: number = 1): Promise<MovieItem[]> {
    if (genreIds.length === 0) return [];

    try {
      const genres = encodeURIComponent(genreIds.slice(0, 3).join('|'));
      const data = await fetchJsonCached<TMDBResponse>(
        '/discover/movie',
        `language=en-US&sort_by=vote_count.desc&include_adult=false&include_video=false&vote_count.gte=120&with_genres=${genres}&page=${page}`
      );
      return Array.isArray(data.results) ? data.results.map(mapTMDBMovie) : [];
    } catch (error) {
      console.error(`[TMDB] Error discovering movies by genre on page ${page}:`, error);
      return [];
    }
  },

  /**
   * Fetch movies trending today or this week from TMDB
   */
  async getTrendingMovies(timeWindow: TrendingWindow = 'week'): Promise<MovieItem[]> {
    try {
      const data = await fetchJsonCached<TMDBResponse>(`/trending/movie/${timeWindow}`, 'language=en-US');
      return Array.isArray(data.results) ? data.results.map(mapTMDBMovie) : [];
    } catch (error) {
      console.error(`[TMDB] Error fetching ${timeWindow} trending movies:`, error);
      return [];
    }
  },

  /**
   * Fetch TMDB recommendations based on a movie
   */
  async getMovieRecommendations(movieId: string): Promise<MovieItem[]> {
    if (!movieId) return [];

    try {
      const data = await fetchJsonCached<TMDBResponse>(`/movie/${movieId}/recommendations`, 'language=en-US');
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
      const data = await fetchJsonCached<TMDBResponse>('/movie/upcoming', 'language=en-US&region=TR');
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
      const data = await fetchJsonCached<TMDBResponse>('/movie/now_playing', 'language=en-US&region=TR');
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
      const data = await fetchJsonCached<TMDBResponse>('/movie/top_rated', 'language=en-US');
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
        `language=en-US&query=${encodedQuery}`,
        15 * 60 * 1000
      );
      if (data && Array.isArray(data.results)) {
        const movies = data.results.map(mapTMDBMovie);
        return movies.length > 0 ? movies : getFallbackMovies(query);
      }
      return getFallbackMovies(query);
    } catch (error) {
      console.error(`[TMDB] Error searching movies for "${query}":`, error);
      return getFallbackMovies(query);
    }
  },

  /**
   * Fetch full details for a movie from TMDB
   */
  async getMovieDetails(movieId: string): Promise<any> {
    try {
      return await fetchJsonCached<any>(
        `/movie/${movieId}`,
        'language=en-US&append_to_response=credits,videos',
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
