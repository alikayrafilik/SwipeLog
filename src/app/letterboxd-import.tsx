import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { File } from 'expo-file-system';
import { clearSharedPayloads, useIncomingShare } from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMovieActions } from '@/context/MovieContext';
import { useFeedback } from '@/context/FeedbackContext';
import { readLetterboxdFiles } from '@/services/letterboxd-files';
import {
  importLetterboxdCsvFiles,
  type LetterboxdImportResult,
} from '@/services/letterboxd-import';
import { getCountBucket, trackEvent } from '@/services/analytics';

interface ImportPreview extends LetterboxdImportResult {
  sourceFiles: number;
}

const helpSteps = [
  'On a computer, open Letterboxd Settings and download your data export.',
  'Send the original ZIP to your phone with Drive, WhatsApp, email, or USB.',
  'Do not extract the ZIP. Choose it here, or use Share → SwipeLog on Android.',
];

const previewRows = (preview: ImportPreview) => [
  { icon: 'film-outline' as const, label: 'Movies matched', value: preview.matched },
  { icon: 'calendar-outline' as const, label: 'Diary logs', value: preview.diaryLogs },
  { icon: 'bookmark-outline' as const, label: 'Watchlist', value: preview.watchlist },
  { icon: 'heart-outline' as const, label: 'Favorites', value: preview.favorites },
  { icon: 'document-text-outline' as const, label: 'Files read', value: preview.sourceFiles },
  { icon: 'help-circle-outline' as const, label: 'Not matched', value: preview.skipped },
];

const friendlyImportError = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('larger than 50 MB')) return message;
  if (message.includes('original Letterboxd ZIP')) return message;
  if (message.toLowerCase().includes('zip')) {
    return 'This ZIP could not be opened. Download a fresh Letterboxd export and try again.';
  }
  return 'SwipeLog could not read this export. Choose the original Letterboxd ZIP or its CSV files.';
};

export default function LetterboxdImportScreen() {
  const insets = useSafeAreaInsets();
  const { importMovies } = useMovieActions();
  const { notify } = useFeedback();
  const { clearSharedPayloads: clearIncomingShare, error: incomingShareError, isResolving, resolvedSharedPayloads } = useIncomingShare();
  const handledShareSignature = useRef<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const analyzeFiles = useCallback(async (files: File[], source: 'picker' | 'share') => {
    if (files.length === 0 || isAnalyzing || isImporting) return;
    setIsAnalyzing(true);
    setPreview(null);
    void trackEvent('letterboxd_import_started', { file_type: source === 'share' ? 'shared_file' : 'archive_or_csv' });

    try {
      const readableFiles = await readLetterboxdFiles(files);
      if (readableFiles.length === 0) {
        notify({
          tone: 'warning',
          title: 'No Letterboxd data found',
          message: 'Choose the original Letterboxd ZIP or CSV files from the extracted export folder.',
        });
        return;
      }

      const imported = await importLetterboxdCsvFiles(readableFiles);
      const nextPreview = { ...imported, sourceFiles: readableFiles.length };
      void trackEvent('letterboxd_import_previewed', {
        matched_count_bucket: getCountBucket(imported.matched),
        file_count_bucket: getCountBucket(readableFiles.length),
      });

      if (imported.matched === 0) {
        notify({
          tone: 'warning',
          title: 'No movies matched',
          message: 'Letterboxd data was found, but no films matched TMDB. Check your connection and try again.',
        });
        return;
      }
      setPreview(nextPreview);
    } catch (error) {
      console.error('[LetterboxdImport] Failed:', error);
      void trackEvent('letterboxd_import_failed', { failure_reason: 'read_or_import_error' });
      notify({ tone: 'error', title: 'Import could not be prepared', message: friendlyImportError(error) });
    } finally {
      setIsAnalyzing(false);
      if (source === 'share') {
        clearIncomingShare();
        clearSharedPayloads();
      }
    }
  }, [clearIncomingShare, isAnalyzing, isImporting, notify]);

  useEffect(() => {
    if (isResolving || incomingShareError || resolvedSharedPayloads.length === 0) return;
    const sharedFiles = resolvedSharedPayloads
      .filter((payload) => payload.contentUri && payload.contentType === 'file')
      .map((payload) => new File(payload.contentUri!));
    const signature = sharedFiles.map((file) => file.uri).join('|');
    if (!signature || handledShareSignature.current === signature) return;
    handledShareSignature.current = signature;
    void analyzeFiles(sharedFiles, 'share');
  }, [analyzeFiles, incomingShareError, isResolving, resolvedSharedPayloads]);

  useEffect(() => {
    if (!incomingShareError) return;
    notify({
      tone: 'error',
      title: 'Shared file could not be opened',
      message: 'Save the ZIP to your phone and choose it manually instead.',
    });
    clearIncomingShare();
  }, [clearIncomingShare, incomingShareError, notify]);

  const pickFiles = async () => {
    const result = await File.pickFileAsync({
      multipleFiles: true,
      mimeTypes: [
        'application/zip',
        'application/x-zip-compressed',
        'text/csv',
        'text/comma-separated-values',
        'application/octet-stream',
      ],
    });
    if (!result.canceled) await analyzeFiles(result.result, 'picker');
  };

  const completeImport = () => {
    if (!preview || isImporting) return;
    setIsImporting(true);
    try {
      importMovies(preview.items);
      void trackEvent('letterboxd_import_completed', {
        matched_count_bucket: getCountBucket(preview.matched),
        result: 'success',
      });
      notify({
        tone: 'success',
        title: 'Import complete',
        message: `${preview.matched} movies were imported. Existing entries were merged by movie and date.`,
      });
      router.back();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View className="flex-1 bg-brand-navy" style={{ paddingTop: insets.top }}>
      <View className="h-16 flex-row items-center gap-3 border-b border-white/10 px-5">
        <Pressable accessibilityLabel="Go back" className="h-11 w-11 items-center justify-center rounded-2xl bg-white/8" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
        </Pressable>
        <View className="min-w-0 flex-1">
          <Text className="text-[18px] font-black text-white">Import from Letterboxd</Text>
          <Text className="text-[10px] font-semibold text-brand-grayText">ZIP or Letterboxd CSV files</Text>
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ gap: 16, padding: 20, paddingBottom: Math.max(insets.bottom + 28, 40) }}
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3 rounded-3xl border border-white/10 bg-brand-navyLight p-5">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-yellow/15">
            <Ionicons name="archive-outline" size={25} color="#F9C80E" />
          </View>
          <Text selectable className="text-[22px] font-black text-white">Bring your movie history</Text>
          <Text selectable className="text-[12px] font-semibold leading-5 text-brand-grayText">
            SwipeLog reads the export on your device. Your Letterboxd password is never requested.
          </Text>
        </View>

        <View className="gap-4 rounded-3xl border border-white/10 bg-brand-navyLight p-5">
          <Text className="text-[13px] font-black uppercase tracking-wider text-brand-yellow">How it works</Text>
          {helpSteps.map((step, index) => (
            <View key={step} className="flex-row items-start gap-3">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-yellow">
                <Text className="text-[11px] font-black text-brand-navy">{index + 1}</Text>
              </View>
              <Text
                selectable
                className="min-w-0 flex-1 text-[11px] font-semibold leading-5"
                style={{ color: '#D5DEE2' }}
              >
                {step}
              </Text>
            </View>
          ))}
        </View>

        {isResolving || isAnalyzing ? (
          <View className="items-center gap-3 rounded-3xl border border-brand-yellow/25 bg-brand-yellow/10 p-6">
            <ActivityIndicator size="large" color="#F9C80E" />
            <Text className="text-[15px] font-black text-white">Analyzing your export</Text>
            <Text className="text-center text-[11px] font-semibold leading-5 text-white/65">Matching films with TMDB. Large libraries may take a moment.</Text>
          </View>
        ) : null}

        {preview ? (
          <View className="gap-4 rounded-3xl border border-brand-yellow/30 bg-[#073746] p-5">
            <View className="flex-row items-center gap-3">
              <Ionicons name="checkmark-circle" size={27} color="#F9C80E" />
              <View className="min-w-0 flex-1">
                <Text className="text-[18px] font-black text-white">Ready to import</Text>
                <Text className="text-[10px] font-semibold text-white/60">Nothing has been added yet.</Text>
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {previewRows(preview).map((row) => (
                <View key={row.label} className="w-[48%] flex-grow rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Ionicons name={row.icon} size={18} color="#F9C80E" />
                  <Text selectable className="pt-2 text-[20px] font-black text-white" style={{ fontVariant: ['tabular-nums'] }}>{row.value}</Text>
                  <Text selectable className="text-[9px] font-bold text-white/55">{row.label}</Text>
                </View>
              ))}
            </View>
            <Text selectable className="text-[10px] font-semibold leading-4 text-white/60">
              Existing movies and diary entries are merged; importing the same export again will not create duplicate dates.
            </Text>
            <Pressable accessibilityLabel="Import Letterboxd data" className="min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-yellow px-4" disabled={isImporting} onPress={completeImport}>
              {isImporting ? <ActivityIndicator size="small" color="#073445" /> : <Ionicons name="download-outline" size={20} color="#073445" />}
              <Text className="text-[15px] font-black text-brand-navy">{isImporting ? 'Importing...' : 'Import data'}</Text>
            </Pressable>
            <Pressable accessibilityLabel="Choose a different export" className="min-h-12 items-center justify-center rounded-2xl border border-white/12" onPress={() => setPreview(null)}>
              <Text className="text-[12px] font-black text-white/70">Choose a different file</Text>
            </Pressable>
          </View>
        ) : null}

        {!preview && !isAnalyzing && !isResolving ? (
          <Pressable accessibilityLabel="Choose Letterboxd export" className="min-h-16 flex-row items-center justify-center gap-3 rounded-2xl bg-brand-yellow px-5" onPress={() => void pickFiles()}>
            <Ionicons name="folder-open-outline" size={23} color="#073445" />
            <Text className="text-[15px] font-black text-brand-navy">Choose ZIP or CSV files</Text>
          </Pressable>
        ) : null}

        <Text selectable className="px-3 text-center text-[10px] font-semibold leading-4 text-white/45">
          SwipeLog is not affiliated with Letterboxd. Film metadata is matched through TMDB.
        </Text>
      </ScrollView>
    </View>
  );
}
