import FeedbackToast, { type FeedbackTone } from '@/components/FeedbackToast';
import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';

interface NotifyOptions {
  duration?: number;
  message: string;
  title?: string;
  tone?: FeedbackTone;
}

interface ConfirmOptions {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title: string;
  tone?: 'default' | 'danger';
}

interface ChoiceAction {
  id: string;
  label: string;
  tone?: 'default' | 'danger';
}

interface ChoiceOptions {
  actions: ChoiceAction[];
  cancelLabel?: string;
  message: string;
  title: string;
}

interface DialogRequest extends ChoiceOptions {
  resolve: (value: string | null) => void;
}

interface FeedbackContextValue {
  choose: (options: ChoiceOptions) => Promise<string | null>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notify: (options: NotifyOptions) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: React.PropsWithChildren) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<(NotifyOptions & { id: number })[]>([]);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const dialogQueue = useRef<DialogRequest[]>([]);
  const nextToastId = useRef(0);

  const notify = useCallback((options: NotifyOptions) => {
    nextToastId.current += 1;
    setToasts((current) => [...current, { ...options, id: nextToastId.current }]);
  }, []);

  const showNextDialog = useCallback(() => {
    setDialog(dialogQueue.current.shift() ?? null);
  }, []);

  const settleDialog = useCallback((value: string | null) => {
    setDialog((current) => {
      current?.resolve(value);
      return null;
    });
    setTimeout(showNextDialog, 0);
  }, [showNextDialog]);

  const choose = useCallback((options: ChoiceOptions) => new Promise<string | null>((resolve) => {
    const request = { ...options, resolve };
    setDialog((current) => {
      if (current) {
        dialogQueue.current.push(request);
        return current;
      }
      return request;
    });
  }), []);

  const confirm = useCallback(async (options: ConfirmOptions) => {
    const result = await choose({
      actions: [{ id: 'confirm', label: options.confirmLabel ?? t('common.confirm'), tone: options.tone }],
      cancelLabel: options.cancelLabel,
      message: options.message,
      title: options.title,
    });
    return result === 'confirm';
  }, [choose, t]);

  const currentToast = toasts[0] ?? null;
  const value = useMemo(() => ({ choose, confirm, notify }), [choose, confirm, notify]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackToast
        duration={currentToast?.duration}
        message={currentToast?.message ?? null}
        onDismiss={() => setToasts((current) => current.slice(1))}
        title={currentToast?.title}
        tone={currentToast?.tone}
      />
      <Modal animationType="fade" onRequestClose={() => settleDialog(null)} statusBarTranslucent transparent visible={Boolean(dialog)}>
        <View className="flex-1 items-center justify-center bg-black/70 px-6" style={{ paddingBottom: insets.bottom }}>
          <Pressable accessibilityLabel="Close dialog" className="absolute inset-0" onPress={() => settleDialog(null)} />
          <View
            accessibilityViewIsModal
            className="w-full max-w-[380px] overflow-hidden rounded-[28px] border border-white/12 bg-[#061E2A] p-5"
            style={{ borderCurve: 'continuous', boxShadow: '0 18px 45px rgba(0, 0, 0, 0.5)' }}
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-yellow/15">
              <Ionicons name={dialog?.actions.some((action) => action.tone === 'danger') ? 'warning-outline' : 'information-circle-outline'} size={23} color="#F9C80E" />
            </View>
            <Text selectable className="pt-4 text-[20px] font-black text-white">{dialog?.title}</Text>
            <Text selectable className="pt-2 text-[13px] font-semibold leading-5 text-white/65">{dialog?.message}</Text>
            <View className="pt-5" style={{ gap: 10 }}>
              {dialog?.actions.map((action) => (
                <Pressable
                  key={action.id}
                  accessibilityLabel={action.label}
                  className={`min-h-12 items-center justify-center rounded-2xl px-4 ${action.tone === 'danger' ? 'bg-red-500' : 'bg-brand-yellow'}`}
                  onPress={() => settleDialog(action.id)}
                >
                  <Text className={`text-[13px] font-black ${action.tone === 'danger' ? 'text-white' : 'text-brand-navy'}`}>{action.label}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityLabel={dialog?.cancelLabel ?? t('common.cancel')} className="min-h-12 items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-4" onPress={() => settleDialog(null)}>
                <Text className="text-[13px] font-black text-white/75">{dialog?.cancelLabel ?? t('common.cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider');
  return context;
}
