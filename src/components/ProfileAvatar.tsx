import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { View } from 'react-native';

interface ProfileAvatarProps {
  uri?: string;
  icon?: string;
  color?: string;
  size?: number;
  roundedClassName?: string;
}

export default function ProfileAvatar({
  uri,
  icon = 'film-outline',
  color = '#F9C80E',
  size = 48,
  roundedClassName = 'rounded-2xl',
}: ProfileAvatarProps) {
  const iconSize = Math.round(size * 0.42);

  return (
    <View
      className={`items-center justify-center overflow-hidden ${roundedClassName}`}
      style={{ height: size, width: size, backgroundColor: uri ? '#0D162D' : color }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ height: '100%', width: '100%' }} contentFit="cover" />
      ) : (
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={iconSize} color="#073445" />
      )}
    </View>
  );
}
