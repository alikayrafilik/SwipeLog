import { MovieItem, tmdbService } from '@/services/tmdb';

export interface LetterboxdImportMovie {
  movie: MovieItem;
  rating: number;
  watchEntries: LetterboxdImportWatchEntry[];
  isWatched: boolean;
  isWatchlist: boolean;
  isLiked: boolean;
}

export interface LetterboxdImportWatchEntry {
  rating: number;
  watchedAt?: string;
  note?: string;
}

export interface LetterboxdImportResult {
  items: LetterboxdImportMovie[];
  matched: number;
  skipped: number;
  diaryLogs: number;
  favorites: number;
  watchlist: number;
}

interface LetterboxdRow {
  Date?: string;
  'Letterboxd URI'?: string;
  Name?: string;
  Rating?: string;
  Rewatch?: string;
  Tags?: string;
  'Watched Date'?: string;
  Year?: string;
  Review?: string;
}

interface LetterboxdAggregate {
  name: string;
  year?: string;
  rating: number;
  ratingDate?: string;
  watchedFallbackAt?: string;
  watchEntries: Map<string, LetterboxdImportWatchEntry>;
  isWatched: boolean;
  isWatchlist: boolean;
  isLiked: boolean;
}

const TMDB_IMPORT_CONCURRENCY = 6;

const normalizeMovieIdentity = (row: LetterboxdRow) => {
  const letterboxdUri = row['Letterboxd URI']?.trim().toLowerCase().replace(/\/+$/, '');
  if (letterboxdUri) return `uri:${letterboxdUri}`;

  const normalizedName = row.Name?.trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
  return `title:${normalizedName ?? ''}::${row.Year?.trim() ?? ''}`;
};

const parseCsv = (text: string): LetterboxdRow[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows[0]?.map((header) => header.replace(/^\uFEFF/, '').trim()) ?? [];
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? '']))
  );
};

const toFiveStarRating = (value?: string) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return 0;

  const starRating = [...trimmed].reduce((total, character) => {
    if (character === '★') return total + 1;
    if (character === '½') return total + 0.5;
    return total;
  }, 0);
  if (starRating > 0) return Math.max(0, Math.min(5, starRating));

  const rating = Number.parseFloat(trimmed.replace(',', '.'));
  if (!Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, rating));
};

const normalizeDate = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? trimmed : date.toISOString();
};

const addOrMergeWatchEntry = (
  entries: Map<string, LetterboxdImportWatchEntry>,
  watchedAt: string | undefined,
  rating: number,
  note?: string
) => {
  if (!watchedAt) return;
  const key = watchedAt.slice(0, 10);
  const existing = entries.get(key);
  entries.set(key, {
    watchedAt,
    rating: rating || existing?.rating || 0,
    note: note?.trim() || existing?.note,
  });
};

const findMovieMatch = async (name: string, year?: string) => {
  const results = await tmdbService.searchMovies(name);
  const normalizeTitle = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .toLowerCase();
  const normalizedName = normalizeTitle(name);
  return (
    results.find(
      (movie) =>
        normalizeTitle(movie.title) === normalizedName &&
        (!year || movie.date?.includes(year))
    ) ??
    results.find((movie) => normalizeTitle(movie.title) === normalizedName)
  );
};

export const importLetterboxdCsvFiles = async (
  assets: { name: string; text: string }[]
): Promise<LetterboxdImportResult> => {
  const aggregates = new Map<string, LetterboxdAggregate>();

  for (const asset of assets) {
    const fileName = asset.name.toLowerCase();
    if (
      ((fileName.includes('/likes/') || fileName.startsWith('likes/')) &&
        !fileName.endsWith('likes/films.csv')) ||
      (!fileName.includes('watchlist') &&
        !fileName.includes('watched') &&
        !fileName.includes('diary') &&
        !fileName.includes('ratings') &&
        !fileName.includes('reviews') &&
        !fileName.includes('likes/films'))
    ) {
      continue;
    }
    const rows = parseCsv(asset.text);

    rows.forEach((row) => {
      const name = row.Name?.trim();
      if (!name) return;
      const year = row.Year?.trim();
      const key = normalizeMovieIdentity(row);
      const current = aggregates.get(key) ?? {
        name,
        year,
        rating: 0,
        watchEntries: new Map<string, LetterboxdImportWatchEntry>(),
        isWatched: false,
        isWatchlist: false,
        isLiked: false,
      };

      const isWatchlistFile = fileName.includes('watchlist');
      const isLikesFile = fileName.includes('likes/films');
      const isDiaryFile = fileName.includes('diary');
      const isReviewsFile = fileName.includes('reviews');
      const isWatchedFile = fileName.includes('watched');
      const rowRating = toFiveStarRating(row.Rating);
      const rowDate = normalizeDate(row.Date);
      const watchedDate = normalizeDate(row['Watched Date']) ?? rowDate;

      if (isWatchlistFile) {
        current.isWatchlist = true;
      }
      if (isLikesFile) {
        current.isLiked = true;
      }
      if (isWatchedFile || isDiaryFile || isReviewsFile) {
        current.isWatched = true;
        if (!current.watchedFallbackAt || (watchedDate ?? '') < current.watchedFallbackAt) {
          current.watchedFallbackAt = watchedDate;
        }
      }

      if (rowRating > 0 && (!current.ratingDate || (rowDate ?? '') >= current.ratingDate)) {
        current.rating = rowRating;
        current.ratingDate = rowDate ?? '';
      }
      if (isDiaryFile || isReviewsFile) {
        addOrMergeWatchEntry(current.watchEntries, watchedDate, rowRating, row.Review);
      }
      aggregates.set(key, current);
    });
  }

  const aggregateList = [...aggregates.values()];
  aggregateList.forEach((aggregate) => {
    if (aggregate.rating <= 0) return;
    aggregate.watchEntries.forEach((entry, key) => {
      if (entry.rating <= 0) {
        aggregate.watchEntries.set(key, { ...entry, rating: aggregate.rating });
      }
    });
  });
  const matchedItems = new Array<LetterboxdImportMovie | null>(aggregateList.length).fill(null);
  let nextAggregateIndex = 0;

  const matchWorker = async () => {
    while (nextAggregateIndex < aggregateList.length) {
      const index = nextAggregateIndex;
      nextAggregateIndex += 1;
      const aggregate = aggregateList[index];
      const movie = await findMovieMatch(aggregate.name, aggregate.year);
      if (!movie) continue;

      matchedItems[index] = {
      movie,
      rating: aggregate.rating,
      watchEntries:
        aggregate.watchEntries.size > 0
          ? [...aggregate.watchEntries.values()].sort((a, b) =>
              (a.watchedAt ?? '').localeCompare(b.watchedAt ?? '')
            )
          : aggregate.isWatched
            ? [{ rating: aggregate.rating, watchedAt: aggregate.watchedFallbackAt }]
            : [],
      isWatched: aggregate.isWatched,
      isWatchlist: aggregate.isWatchlist,
      isLiked: aggregate.isLiked,
      };
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(TMDB_IMPORT_CONCURRENCY, aggregateList.length) },
      () => matchWorker()
    )
  );

  const items = matchedItems.filter((item): item is LetterboxdImportMovie => Boolean(item));
  const skipped = aggregateList.length - items.length;

  return {
    items,
    matched: items.length,
    skipped,
    diaryLogs: items.reduce((total, item) => total + item.watchEntries.length, 0),
    favorites: items.filter((item) => item.isLiked).length,
    watchlist: items.filter((item) => item.isWatchlist).length,
  };
};
