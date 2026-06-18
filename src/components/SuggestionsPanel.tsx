import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { MovieItem } from '@/services/tmdb';

export interface SuggestionsPanelProps {
  loading: boolean;
  movies: MovieItem[];
  onSelectMovie: (movie: MovieItem) => void;
}

const getYear = (date?: string) => {
  if (!date) return '';
  return date.match(/\d{4}/)?.[0] ?? date;
};

export default function SuggestionsPanel({ loading, movies, onSelectMovie }: SuggestionsPanelProps) {
  const displayMovies = movies.slice(0, 3);

  if (loading && displayMovies.length === 0) {
    return (
      <View className="mt-3 rounded-xl bg-[#82919A] px-4 py-5" style={{ borderCurve: 'continuous' }}>
        <ActivityIndicator size="small" color="#F9C80E" />
      </View>
    );
  }

  if (!loading && displayMovies.length === 0) {
    return (
      <View className="mt-3 rounded-xl bg-[#82919A] px-4 py-5" style={{ borderCurve: 'continuous' }}>
        <Text selectable className="text-center text-sm font-semibold text-white/80">
          No matching movies found.
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-3 overflow-hidden rounded-xl bg-[#82919A]" style={{ borderCurve: 'continuous' }}>
      {displayMovies.map((movie, index) => {
        const year = getYear(movie.date);

        return (
          <Pressable
            key={movie.id}
            className={`flex-row gap-3 px-3 py-2.5 ${
              index < displayMovies.length - 1 ? 'border-b border-white/10' : ''
            }`}
            onPress={() => onSelectMovie(movie)}
          >
            <View
              className="h-[68px] w-12 overflow-hidden rounded-lg bg-[#FFB300]"
              style={{ borderCurve: 'continuous' }}
            >
              {movie.image ? (
                <Image source={{ uri: movie.image }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Ionicons name="film" size={18} color="#051E2A" />
                </View>
              )}
            </View>

            <View className="min-w-0 flex-1 justify-center">
              {year ? (
                <Text selectable className="text-[11px] font-black text-[#F9C80E]">
                  {year}
                </Text>
              ) : null}
              <Text selectable numberOfLines={1} className="text-[16px] font-black leading-5 text-white">
                {movie.title}
              </Text>
              <Text
                selectable
                numberOfLines={2}
                ellipsizeMode="tail"
                className="text-[11px] font-medium leading-4 text-white/82"
              >
                {movie.overview || 'No overview is available for this movie yet.'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
