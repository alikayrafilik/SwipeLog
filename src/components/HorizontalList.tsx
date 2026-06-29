import React from 'react';
import { FlatList, View } from 'react-native';
import MovieCard, { MovieCardProps } from './MovieCard';

export interface HorizontalMovieItem extends MovieCardProps {
  id: string;
  listKey?: string;
  overview?: string;
}

interface HorizontalListProps {
  data: HorizontalMovieItem[];
  onPressMovie?: (movie: HorizontalMovieItem) => void;
}

export default function HorizontalList({ data, onPressMovie }: HorizontalListProps) {
  return (
    <View className="my-1">
      <FlatList
        data={data}
        renderItem={({ item, index }) => (
          <MovieCard
            index={index}
            badgeLabel={item.badgeLabel}
            image={item.image}
            title={item.title}
            date={item.date}
            rating={item.rating}
            onPress={onPressMovie ? () => onPressMovie(item) : undefined}
          />
        )}
        keyExtractor={(item, index) => item.listKey ?? `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      />
    </View>
  );
}
