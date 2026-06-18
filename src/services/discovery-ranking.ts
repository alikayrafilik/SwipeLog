import type { DiscoveryAction, LoggedMovie } from '@/context/MovieContext';
import type { MovieItem } from '@/services/tmdb';

const GENRE_NAMES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

export interface DiscoverySignal {
  action: DiscoveryAction;
  movie: MovieItem;
}

export interface TasteProfile {
  genreScores: Map<number, number>;
  topGenres: { id: number; name: string; score: number }[];
  hasHistory: boolean;
}

export interface PersonalizedCandidate extends MovieItem {
  reason: string;
  source: 'recommended' | 'taste' | 'trending' | 'popular';
  personalScore: number;
}

const addGenres = (scores: Map<number, number>, genreIds: number[] | undefined, weight: number) => {
  genreIds?.forEach((genreId) => scores.set(genreId, (scores.get(genreId) ?? 0) + weight));
};

export const buildTasteProfile = (
  movies: LoggedMovie[],
  discoverySignals: DiscoverySignal[]
): TasteProfile => {
  const genreScores = new Map<number, number>();

  movies.forEach((movie) => {
    let weight = 0;
    if (movie.isLiked) weight += 4;
    if (movie.isWatchlist) weight += 0.75;
    if (movie.isWatched && movie.rating > 0) weight += (movie.rating - 2.5) * 1.6;
    addGenres(genreScores, movie.genreIds, weight);
  });

  discoverySignals.slice(-80).forEach(({ action, movie }) => {
    const weight = action === 'liked' ? 1.5 : action === 'skipped' ? -0.65 : action === 'watched' ? 0.5 : 0;
    addGenres(genreScores, movie.genreIds, weight);
  });

  const topGenres = [...genreScores.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, score]) => ({ id, score, name: GENRE_NAMES[id] ?? 'Movies you enjoy' }));

  return {
    genreScores,
    topGenres,
    hasHistory: movies.some((movie) => movie.isLiked || movie.isWatched || movie.isWatchlist),
  };
};

export const rankDiscoveryCandidates = (
  candidates: Omit<PersonalizedCandidate, 'personalScore'>[],
  tasteProfile: TasteProfile
): PersonalizedCandidate[] => {
  return candidates
    .map((movie) => {
      const matchingGenres = (movie.genreIds ?? [])
        .map((id) => ({ id, score: tasteProfile.genreScores.get(id) ?? 0 }))
        .filter((genre) => genre.score > 0)
        .sort((a, b) => b.score - a.score);
      const genreScore = matchingGenres.reduce((total, genre) => total + genre.score, 0);
      const strongestGenre = matchingGenres[0];
      const qualityScore = (movie.rating ?? 0) * 0.3;
      const sourceBoost =
        movie.source === 'recommended' ? 4 : movie.source === 'taste' ? 2.5 : movie.source === 'trending' ? 1 : 0;

      return {
        ...movie,
        personalScore: genreScore + qualityScore + sourceBoost,
        reason:
          movie.source === 'recommended'
            ? movie.reason
            : strongestGenre
              ? `Because you enjoy ${GENRE_NAMES[strongestGenre.id] ?? 'similar movies'}`
              : movie.reason,
      };
    })
    .sort((a, b) => b.personalScore - a.personalScore);
};
