import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface ExportPayload {
  exportedAt: string;
  profile: unknown;
  movies: unknown;
  watchHistory: unknown;
  customLists: unknown;
  discoveryEvents: unknown;
}

export const shareDataExport = async (payload: ExportPayload) => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }

  const date = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `swipelog-export-${date}.json`);
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(payload, null, 2));

  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Export SwipeLog data',
    mimeType: 'application/json',
  });
};
