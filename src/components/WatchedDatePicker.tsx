import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MIN_DATE = new Date(1950, 0, 1);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const toInputDate = (date: Date) => {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const parseInputDate = (value: string) => {
  const [day, month, year] = value.split('-').map((part) => Number.parseInt(part, 10));
  if (!day || !month || !year) return new Date();
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
};

const formatDisplayDate = (value: string) =>
  parseInputDate(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

const getMonthLabel = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

const isBeforeMonth = (date: Date, boundary: Date) =>
  date.getFullYear() < boundary.getFullYear() ||
  (date.getFullYear() === boundary.getFullYear() && date.getMonth() < boundary.getMonth());

const isAfterMonth = (date: Date, boundary: Date) =>
  date.getFullYear() > boundary.getFullYear() ||
  (date.getFullYear() === boundary.getFullYear() && date.getMonth() > boundary.getMonth());

type CalendarDay = { date: Date; key: string } | { date?: undefined; key: string };

interface WatchedDatePickerProps {
  error?: string | null;
  helperText?: string;
  label?: string;
  onChange: (value: string) => void;
  value: string;
}

export default function WatchedDatePicker({
  error,
  helperText = 'Choose a date from the calendar.',
  label = 'Watched Date',
  onChange,
  value,
}: WatchedDatePickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const selectedDate = useMemo(() => parseInputDate(value), [value]);
  const maxDate = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );
  const todayKey = getDateKey(maxDate);
  const selectedKey = getDateKey(selectedDate);
  const canGoPrevious = !isBeforeMonth(addMonths(visibleMonth, -1), MIN_DATE);
  const canGoNext = !isAfterMonth(addMonths(visibleMonth, 1), maxDate);
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay.getDay() }, (_, index) => ({ key: `blank-${index}` })),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(year, month, index + 1);
        return { date, key: getDateKey(date) };
      }),
    ];
  }, [visibleMonth]);

  return (
    <View className="gap-2">
      <Text selectable className="text-[10px] font-extrabold uppercase text-brand-grayText">
        {label}
      </Text>
      <Pressable
        accessibilityLabel={`Choose ${label.toLowerCase()}`}
        className={`h-12 flex-row items-center justify-between rounded-xl border px-3 ${
          error ? 'border-red-400/60 bg-red-500/10' : 'border-white/10 bg-[#0B4151]'
        }`}
        onPress={() => setIsPickerOpen((current) => !current)}
      >
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[13px] font-black text-white">
            {formatDisplayDate(value)}
          </Text>
          <Text className="mt-0.5 text-[9px] font-bold text-brand-grayText">
            {value}
          </Text>
        </View>
        <Ionicons name="calendar-outline" size={20} color={error ? '#FCA5A5' : '#F9C80E'} />
      </Pressable>

      {isPickerOpen ? (
        <View className="rounded-xl border border-white/10 bg-[#0B4151] p-3">
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable
              accessibilityLabel="Previous month"
              className={`h-9 w-9 items-center justify-center rounded-lg ${
                canGoPrevious ? 'bg-white/8' : 'bg-white/3'
              }`}
              disabled={!canGoPrevious}
              onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
            >
              <Ionicons name="chevron-back" size={18} color={canGoPrevious ? '#FFFFFF' : '#64748B'} />
            </Pressable>
            <Text className="text-[13px] font-black text-white">{getMonthLabel(visibleMonth)}</Text>
            <Pressable
              accessibilityLabel="Next month"
              className={`h-9 w-9 items-center justify-center rounded-lg ${
                canGoNext ? 'bg-white/8' : 'bg-white/3'
              }`}
              disabled={!canGoNext}
              onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
            >
              <Ionicons name="chevron-forward" size={18} color={canGoNext ? '#FFFFFF' : '#64748B'} />
            </Pressable>
          </View>

          <View className="mb-1 flex-row">
            {WEEKDAYS.map((day) => (
              <Text key={day} className="flex-1 text-center text-[9px] font-black uppercase text-brand-grayText">
                {day}
              </Text>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {calendarDays.map((item) => {
              if (!item.date) return <View key={item.key} className="aspect-square w-[14.285%]" />;
              const isSelected = item.key === selectedKey;
              const isToday = item.key === todayKey;
              const isDisabled = item.date < MIN_DATE || item.date > maxDate;
              return (
                <Pressable
                  key={item.key}
                  accessibilityLabel={`Choose ${formatDisplayDate(toInputDate(item.date))}`}
                  className="aspect-square w-[14.285%] items-center justify-center p-0.5"
                  disabled={isDisabled}
                  onPress={() => {
                    onChange(toInputDate(item.date));
                    setIsPickerOpen(false);
                  }}
                >
                  <View
                    className={`h-8 w-8 items-center justify-center rounded-full border ${
                      isSelected
                        ? 'border-brand-yellow bg-brand-yellow'
                        : isToday
                          ? 'border-brand-yellow/60 bg-brand-yellow/10'
                          : 'border-transparent bg-transparent'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-black ${
                        isDisabled
                          ? 'text-white/20'
                          : isSelected
                            ? 'text-brand-navy'
                            : 'text-white'
                      }`}
                    >
                      {item.date.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text selectable className={`text-[9px] font-bold ${error ? 'text-red-200' : 'text-brand-grayText'}`}>
        {error ?? helperText}
      </Text>
    </View>
  );
}
