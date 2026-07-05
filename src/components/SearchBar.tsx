import React, { useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  TextInput,
  TextInputSubmitEditingEventData,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  showClearButton?: boolean;
}

export default function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  inputRef,
  onBlur,
  onFocus,
  placeholder = 'Search...',
  showClearButton = false,
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const shouldShowClearButton = showClearButton || value.length > 0;

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleSubmit = (_event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    onSubmit();
  };

  return (
    <View
      className={`h-12 flex-row items-center rounded-2xl border px-3 ${
        isFocused
          ? 'border-brand-yellow/55 bg-brand-navyLight'
          : 'border-white/10 bg-brand-navyLight'
      }`}
      style={{
        borderCurve: 'continuous',
        boxShadow: isFocused ? '0 8px 24px rgba(249, 200, 14, 0.10)' : '0 8px 22px rgba(0, 0, 0, 0.18)',
      }}
    >
      <Pressable
        accessibilityLabel={shouldShowClearButton ? 'Close search' : 'Search'}
        className="h-8 w-8 items-center justify-center"
        onPress={shouldShowClearButton ? onClear : undefined}
      >
        <Ionicons name={shouldShowClearButton ? 'close' : 'search'} size={19} color={isFocused ? '#F9C80E' : '#A0AEC0'} />
      </Pressable>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={handleSubmit}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor="#76849A"
        selectionColor="#F9C80E"
        returnKeyType="search"
        keyboardAppearance="dark"
        autoCorrect={false}
        autoCapitalize="none"
        className="min-w-0 flex-1 px-1 text-[14px] font-bold text-white"
      />

      <Pressable
        accessibilityLabel="Submit search"
        className="h-8 w-8 items-center justify-center"
        onPress={onSubmit}
      >
        <View className={`h-7 w-7 items-center justify-center rounded-lg ${value.length > 0 ? 'bg-brand-yellow' : 'bg-white/5'}`}>
          <Ionicons name="arrow-forward" size={16} color={value.length > 0 ? '#050814' : '#76849A'} />
        </View>
      </Pressable>
    </View>
  );
}
