import { File } from 'expo-file-system';
import { strFromU8, unzipSync } from 'fflate';

export interface LetterboxdCsvFile {
  name: string;
  text: string;
}

const MAX_ARCHIVE_SIZE = 50 * 1024 * 1024;
const MAX_CSV_FILES = 20;

const normalizePath = (path: string) => path.replace(/\\/g, '/').replace(/^\/+/, '');

const isSupportedLetterboxdPath = (path: string) => {
  const normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith('likes/films.csv')) return true;
  if (normalized.includes('/likes/') || normalized.startsWith('likes/')) return false;
  const fileName = normalized.split('/').pop();
  return ['watchlist.csv', 'watched.csv', 'diary.csv', 'ratings.csv', 'reviews.csv'].includes(
    fileName ?? ''
  );
};

const isZip = (file: File, bytes: Uint8Array) =>
  file.name.toLowerCase().endsWith('.zip') ||
  file.type === 'application/zip' ||
  (bytes[0] === 0x50 && bytes[1] === 0x4b);

const looksLikeLetterboxdCsv = (text: string) => {
  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]?.toLowerCase() ?? '';
  return header.includes('name') && header.includes('year');
};

const inferCsvName = (name: string, uri: string, text: string) => {
  const identity = decodeURIComponent(`${name} ${uri}`).toLowerCase();
  if (identity.includes('likes') && identity.includes('films')) return 'likes/films.csv';
  if (identity.includes('likes')) return '';
  const knownFile = ['watchlist', 'watched', 'diary', 'ratings', 'reviews'].find((fileName) =>
    identity.includes(fileName)
  );
  if (knownFile) return `${knownFile}.csv`;
  if (name.toLowerCase().endsWith('.csv')) return name;

  const header = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0]?.toLowerCase() ?? '';
  if (header.includes('review')) return 'reviews.csv';
  if (header.includes('watched date')) return 'diary.csv';
  if (header.includes('rating')) return 'ratings.csv';
  return '';
};

export const readLetterboxdFiles = async (files: File[]): Promise<LetterboxdCsvFile[]> => {
  const csvFiles: LetterboxdCsvFile[] = [];

  for (const file of files) {
    const bytes = await file.bytes();

    if (isZip(file, bytes)) {
      if (bytes.byteLength > MAX_ARCHIVE_SIZE) {
        throw new Error('The selected Letterboxd ZIP file is larger than 50 MB.');
      }

      const entries = unzipSync(bytes);
      Object.entries(entries)
        .filter(([name]) => isSupportedLetterboxdPath(name))
        .slice(0, MAX_CSV_FILES)
        .forEach(([name, contents]) => {
          const text = strFromU8(contents);
          if (looksLikeLetterboxdCsv(text)) {
            csvFiles.push({ name: normalizePath(name), text });
          }
        });
      continue;
    }

    const text = strFromU8(bytes);
    if (looksLikeLetterboxdCsv(text)) {
      const inferredName = inferCsvName(file.name, file.uri, text);
      if (!inferredName) {
        throw new Error(
          'Android could not identify whether the selected file is watched.csv or watchlist.csv. Import the original Letterboxd ZIP instead.'
        );
      }
      csvFiles.push({ name: inferredName, text });
    }
  }

  return csvFiles;
};
