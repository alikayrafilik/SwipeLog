import React from 'react';
import { View, Text, Image, ImageSourcePropType, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface MovieCardProps {
  badgeLabel?: string;
  image: string | ImageSourcePropType;
  title: string;
  date?: string;
  rating?: number; // 0 to 5 scale
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.32; // standard responsive width for 3 cards on screen

export default function MovieCard({ badgeLabel, image, title, date, rating }: MovieCardProps) {
  // Helper to render rating stars
  const renderStars = (score: number) => {
    const stars = [];
    const fullStars = Math.floor(score);
    const hasHalf = score % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<Ionicons key={i} name="star" size={11} color="#F9C80E" />);
      } else if (i === fullStars + 1 && hasHalf) {
        stars.push(<Ionicons key={i} name="star-half" size={11} color="#F9C80E" />);
      } else {
        stars.push(<Ionicons key={i} name="star-outline" size={11} color="#F9C80E" />);
      }
    }
    return stars;
  };

  const hasImage = typeof image === 'string' ? !!image.trim() : !!image;

  return (
    <View style={{ width: CARD_WIDTH }} className="mr-3 mb-2">
      {/* Movie Poster Wrapper */}
      <View className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-brand-navyLight border border-slate-800/80 items-center justify-center">
        {hasImage ? (
          <Image
            source={typeof image === 'string' ? { uri: image } : image}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center justify-center p-3 w-full h-full bg-brand-navyLight">
            <Ionicons name="film-outline" size={28} color="#A0AEC0" />
            <Text 
              className="text-brand-grayText text-[10px] font-semibold text-center mt-2" 
              numberOfLines={3}
            >
              {title}
            </Text>
          </View>
        )}
        {badgeLabel ? (
          <View className="absolute left-2 top-2 rounded-full bg-brand-yellow px-2 py-1">
            <Text className="text-[8px] font-black uppercase text-brand-navy">
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Movie Meta Information */}
      <View className="mt-2 px-1">
        <Text 
          numberOfLines={1} 
          className="text-white text-sm font-semibold tracking-wide"
        >
          {title}
        </Text>
        
        {date && (
          <Text className="text-brand-grayText text-[11px] mt-0.5 font-medium">
            {date}
          </Text>
        )}

        {rating !== undefined && (
          <View className="flex-row items-center mt-1 space-x-0.5">
            {renderStars(rating)}
          </View>
        )}
      </View>
    </View>
  );
}
