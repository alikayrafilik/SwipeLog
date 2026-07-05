import { useAuthActions, useAuthState } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

const validateStrongPassword = (password: string) => {
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[@$!%*?&._\-#+]/.test(password);

  if (password.length < 8) return 'Password must contain at least 8 characters.';
  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    return 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.';
  }
  return null;
};

const getFirebaseErrorCode = (error: Error) =>
  'code' in error && typeof error.code === 'string' ? error.code : null;

export default function AuthScreen() {
  const { height } = useWindowDimensions();
  const panelTranslateY = useSharedValue(height);
  const { authLinkError, authLinkMessage, pendingPasswordReset } = useAuthState();
  const {
    clearAuthLinkError,
    clearAuthLinkMessage,
    clearPendingPasswordReset,
    confirmPasswordResetCode,
    resetPasswordForEmail,
    signIn,
    signUp,
    signOut,
  } = useAuthActions();

  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isSignUp = mode === 'signUp';
  const isForgotPassword = mode === 'forgotPassword';
  const isResetPassword = Boolean(pendingPasswordReset);
  const showBackButton = isForgotPassword || isResetPassword;
  const panelMaxHeight = Math.max(430, Math.min(620, height * 0.66));
  const cardTitle = isForgotPassword
    ? 'Forgot Password?'
    : isResetPassword
      ? 'Reset Password'
    : isSignUp
      ? 'Sign up'
      : 'Login';
  const subtitle = isForgotPassword
    ? 'Enter your email and we will send you a password reset link.'
    : isResetPassword
      ? 'Create a new password for your SwipeLog account.'
    : isSignUp
      ? 'Create an account and keep your movie journey synced.'
      : 'Sign in to continue your movie journey.';
  const submitLabel = isForgotPassword
    ? 'Send reset link'
    : isResetPassword
      ? 'Update password'
    : isSignUp
      ? 'Sign Up'
      : 'Login';
  const submitIcon = isForgotPassword
    ? 'mail-outline'
    : isResetPassword
      ? 'key-outline'
    : isSignUp
      ? 'person-add-outline'
      : 'log-in-outline';
  const switchPrompt = isForgotPassword
    ? 'Remembered your password?'
    : isResetPassword
      ? 'Remembered your password?'
    : isSignUp
      ? 'Already have an account?'
      : "Don't have an account?";
  const switchActionLabel = isForgotPassword || isResetPassword || isSignUp ? 'Sign in' : 'Sign up';

  useEffect(() => {
    panelTranslateY.set(height);
    panelTranslateY.set(
      withTiming(0, {
        duration: 620,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [height, panelTranslateY]);

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: panelTranslateY.value }],
  }));

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (isResetPassword) {
      if (!pendingPasswordReset) {
        Alert.alert('Reset link missing', 'Open the latest password reset email and try again.');
        setMode('forgotPassword');
        return;
      }

      const passwordError = validateStrongPassword(password);
      if (passwordError) {
        Alert.alert('Weak password', passwordError);
        return;
      }

      if (password !== confirmPassword) {
        Alert.alert('Passwords do not match', 'Enter the same password twice.');
        return;
      }

      try {
        setLoading(true);
        const { error } = await confirmPasswordResetCode(pendingPasswordReset.code, password);
        if (error) {
          Alert.alert('Password reset failed', error.message);
          return;
        }
        setMode('signIn');
        setPassword('');
        setConfirmPassword('');
      } catch (error) {
        Alert.alert(
          'Something went wrong',
          error instanceof Error ? error.message : 'Please try again.'
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isForgotPassword) {
      if (!normalizedEmail) {
        Alert.alert('Email required', 'Enter your email address and we will send a reset link.');
        return;
      }

      try {
        setLoading(true);
        const { error } = await resetPasswordForEmail(normalizedEmail);
        if (error) {
          Alert.alert('Reset link failed', error.message);
          return;
        }
        Alert.alert('Check your email', 'Open the password reset link to create a new password, then return to SwipeLog and sign in.');
        setMode('signIn');
      } catch (error) {
        Alert.alert(
          'Something went wrong',
          error instanceof Error ? error.message : 'Please try again.'
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!normalizedEmail || !password) {
      Alert.alert('Missing information', 'Enter your email and password.');
      return;
    }

    if (!isSignUp && password.length < 6) {
      Alert.alert('Password too short', 'Password must contain at least 6 characters.');
      return;
    }

    if (isSignUp) {
      const passwordError = validateStrongPassword(password);
      if (passwordError) {
        Alert.alert('Weak password', passwordError);
        return;
      }
    }

    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password twice.');
      return;
    }

    try {
      setLoading(true);

      if (isSignUp) {
        const { data, error } = await signUp(normalizedEmail, password);

        if (error) {
          const errorCode = getFirebaseErrorCode(error);
          if (errorCode === 'auth/email-already-in-use') {
            Alert.alert(
              'Email already has an account',
              'Try signing in with this email. If this is an old cloud sync account, reset your password to create a Firebase password.',
              [
                {
                  text: 'Reset password',
                  onPress: () => {
                    setMode('forgotPassword');
                    setPassword('');
                    setConfirmPassword('');
                  },
                },
                { text: 'Sign in', onPress: () => setMode('signIn') },
              ]
            );
            return;
          }

          Alert.alert('Sign up failed', error.message);
          return;
        }

        if (!data.session) {
          Alert.alert(
            'Check your email',
            'Open the verification link sent to your email, then return and sign in.'
          );
          setMode('signIn');
          setPassword('');
          setConfirmPassword('');
        } else {
          // Keep the post-signup flow explicit until the email verification link is opened.
          await signOut();
          setMode('signIn');
          setPassword('');
          setConfirmPassword('');
          Alert.alert('Account created', 'Please sign in with the account you just created.');
        }
      } else {
        const { error } = await signIn(normalizedEmail, password);

        if (error) {
          Alert.alert('Login failed', error.message);
        }
      }
    } catch (error) {
      Alert.alert(
        'Something went wrong',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#052F3E]" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient
          pointerEvents="none"
          colors={['#062D3B', '#052F3E', '#031E2A']}
          locations={[0, 0.48, 1]}
          className="absolute inset-0"
        />

        <View className="flex-1 overflow-hidden">
          <View className="absolute inset-x-0 top-0 flex-row opacity-85">
            {[
              ['#0F4C5C', '#101828'],
              ['#8A1C2C', '#141827'],
              ['#384C78', '#061A24'],
              ['#7A5C24', '#102A36'],
            ].map(([start, end], index) => (
              <View
                key={`${start}-${index}`}
                className="h-56 flex-1 overflow-hidden border-r border-white/5"
                style={{
                  transform: [
                    { translateY: index % 2 ? -18 : 12 },
                    { rotate: index % 2 ? '8deg' : '-8deg' },
                  ],
                }}
              >
                <LinearGradient colors={[start, end]} className="h-full w-full">
                  <View className="absolute left-4 top-8 h-20 w-14 rounded-xl bg-white/10" />
                  <View className="absolute bottom-8 right-3 h-24 w-16 rounded-2xl bg-black/20" />
                  <View className="absolute bottom-5 left-3 h-2 w-16 rounded-full bg-white/20" />
                </LinearGradient>
              </View>
            ))}
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={['rgba(5,47,62,0.08)', 'rgba(5,47,62,0.35)', '#052F3E']}
            className="absolute inset-0"
          />

          <View className="items-center px-8" style={{ paddingTop: height * 0.07 }}>
            <Image
              source={require('../../assets/images/swipelog-logo-concept3-hero.png')}
              style={{ width: 96, height: 96 }}
              contentFit="contain"
            />
            <Text className="mt-4 text-center text-[32px] font-black uppercase tracking-wide text-white">
              SwipeLog
            </Text>
            <Text className="mt-4 text-center text-2xl font-black leading-9 text-white">
              Track films you have watched. Save those you want to see.
            </Text>
          </View>

          {showBackButton ? (
            <Pressable
              accessibilityLabel="Go back to sign in"
              className="absolute left-6 top-8 h-14 w-14 items-center justify-center rounded-2xl bg-white/18"
            onPress={() => {
              setMode('signIn');
              setPassword('');
              setConfirmPassword('');
              clearPendingPasswordReset();
            }}
            >
              <Ionicons name="arrow-back" size={30} color="#FFFFFF" />
            </Pressable>
          ) : null}

          <Animated.View
            className="absolute inset-x-0 bottom-0 px-6"
            style={panelAnimatedStyle}
          >
            <View
              className="overflow-hidden rounded-t-[36px] border border-b-0 border-white/35 bg-white/20 p-5"
              style={{ maxHeight: panelMaxHeight }}
            >
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.34)', 'rgba(255,255,255,0.14)', 'rgba(10,37,47,0.45)']}
                className="absolute inset-0"
              />

              <ScrollView
                automaticallyAdjustKeyboardInsets
                contentContainerStyle={{ paddingBottom: 18, gap: 16 }}
                contentInsetAdjustmentBehavior="automatic"
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View className="items-center gap-2">
                  <Text className="text-center text-[42px] font-black leading-[54px] text-white">
                    {cardTitle}
                  </Text>
                  <Text className="px-2 text-center text-base font-bold leading-6 text-white">
                    {subtitle}
                  </Text>
                </View>

                <View className="gap-4">
                  {authLinkError ? (
                    <View className="flex-row gap-3 rounded-2xl border border-red-200/35 bg-red-500/15 p-3">
                      <Ionicons name="warning-outline" size={18} color="#FCA5A5" />
                      <View className="min-w-0 flex-1 gap-1">
                        <Text className="text-xs font-black text-red-50">Link could not be opened</Text>
                        <Text className="text-[11px] font-semibold leading-4 text-red-50/75">
                          {authLinkError}
                        </Text>
                      </View>
                      <Pressable accessibilityLabel="Dismiss auth link error" hitSlop={8} onPress={clearAuthLinkError}>
                        <Ionicons name="close" size={18} color="#FCA5A5" />
                      </Pressable>
                    </View>
                  ) : null}

                  {authLinkMessage ? (
                    <View className="flex-row gap-3 rounded-2xl border border-emerald-200/35 bg-emerald-500/15 p-3">
                      <Ionicons name="checkmark-circle-outline" size={18} color="#BBF7D0" />
                      <View className="min-w-0 flex-1">
                        <Text className="text-[11px] font-semibold leading-4 text-emerald-50/85">
                          {authLinkMessage}
                        </Text>
                      </View>
                      <Pressable accessibilityLabel="Dismiss auth link message" hitSlop={8} onPress={clearAuthLinkMessage}>
                        <Ionicons name="close" size={18} color="#BBF7D0" />
                      </Pressable>
                    </View>
                  ) : null}

                  <View className="h-16 flex-row items-center rounded-3xl border border-white/55 bg-white/18 px-5">
                    <Ionicons name="mail-outline" size={24} color="#FFFFFF" />

                    <TextInput
                      value={pendingPasswordReset?.email ?? email}
                      onChangeText={setEmail}
                      placeholder="Email"
                      placeholderTextColor="rgba(255,255,255,0.68)"
                      keyboardType="email-address"
                      editable={!pendingPasswordReset}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="ml-4 flex-1 text-base font-bold text-white"
                    />
                  </View>

                  {!isForgotPassword ? (
                    <View className="h-16 flex-row items-center rounded-3xl border border-white/55 bg-white/18 px-5">
                      <Ionicons name="lock-closed-outline" size={24} color="#FFFFFF" />

                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Password"
                        placeholderTextColor="rgba(255,255,255,0.68)"
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!passwordVisible}
                        className="ml-4 flex-1 text-base font-bold text-white"
                      />

                      <Pressable
                        accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                        hitSlop={8}
                        onPress={() => setPasswordVisible((current) => !current)}
                      >
                        <Ionicons
                          name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color="#FFFFFF"
                        />
                      </Pressable>
                    </View>
                  ) : null}

                  {isSignUp || isResetPassword ? (
                    <View className="h-16 flex-row items-center rounded-3xl border border-white/55 bg-white/18 px-5">
                      <Ionicons name="shield-checkmark-outline" size={24} color="#FFFFFF" />

                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm password"
                        placeholderTextColor="rgba(255,255,255,0.68)"
                        autoCapitalize="none"
                        autoCorrect={false}
                        secureTextEntry={!passwordVisible}
                        className="ml-4 flex-1 text-base font-bold text-white"
                      />
                    </View>
                  ) : null}

                  {!isSignUp && !isForgotPassword && !isResetPassword ? (
                    <Pressable
                      accessibilityLabel="Reset forgotten password"
                      className="self-end py-1"
                      hitSlop={8}
                      onPress={() => {
                        setMode('forgotPassword');
                        setPassword('');
                        setConfirmPassword('');
                      }}
                    >
                      <Text className="text-sm font-black text-brand-yellow">Forgot Password?</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityLabel={submitLabel}
                    className="mt-2 h-16 flex-row items-center justify-center gap-2 rounded-3xl bg-brand-yellow"
                    disabled={loading}
                    onPress={handleSubmit}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#073445" />
                    ) : (
                      <Ionicons
                        name={submitIcon}
                        size={22}
                        color="#073445"
                      />
                    )}

                    <Text className="text-xl font-black text-brand-navy">
                      {loading ? 'Please wait...' : submitLabel}
                    </Text>
                  </Pressable>

                  <View className="flex-row flex-wrap items-center justify-center pt-1">
                    <Text className="text-sm font-semibold text-white/88">
                      {switchPrompt}
                    </Text>

                    <Pressable
                      hitSlop={8}
                      onPress={() => {
                        setMode((current) => {
                          if (current === 'forgotPassword') return 'signIn';
                          return current === 'signUp' ? 'signIn' : 'signUp';
                        });
                        setPassword('');
                        setConfirmPassword('');
                        clearPendingPasswordReset();
                      }}
                    >
                      <Text className="ml-1 text-sm font-black text-brand-yellow">
                        {switchActionLabel}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
