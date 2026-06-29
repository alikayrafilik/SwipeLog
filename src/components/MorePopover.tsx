import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MorePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  bottomOffset: number;
}

export default function MorePopover({ isOpen, onClose, bottomOffset }: MorePopoverProps) {
  if (!isOpen) return null;

  const menuItems = [
    { id: 'movies', label: 'Movies', icon: 'film-outline' as const },
    { id: 'logger', label: 'Logger', icon: 'calendar-outline' as const },
    { id: 'swipe', label: 'Swipe', icon: 'albums-outline' as const },
    { id: 'tierlist', label: 'Tierlist', icon: 'stats-chart-outline' as const },
    { id: 'quicklog', label: 'Quick Log', icon: 'flash-outline' as const },
  ];

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} className="z-40">
      {/* Backdrop to dim background */}
      <Pressable 
        onPress={onClose} 
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} 
        className="bg-black/60"
      />
      
      {/* Popover Menu box (positioned dynamically above the tab bar) */}
      <View 
        style={{
          position: 'absolute',
          bottom: bottomOffset,
          right: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 15,
          elevation: 10,
        }}
        className="w-52 bg-brand-navyLight border border-slate-800/80 rounded-xl p-3 shadow-2xl z-50"
      >
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => {
              onClose();
            }}
            activeOpacity={0.7}
            className={`flex-row items-center py-3 px-3 rounded-lg ${
              index !== menuItems.length - 1 ? 'border-b border-slate-800/50' : ''
            } active:bg-slate-800/40`}
          >
            <Ionicons name={item.icon} size={20} color="#F9C80E" />
            <Text className="text-white font-medium ml-3 text-[15px]">{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
