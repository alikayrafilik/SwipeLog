import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert('Missing information', 'Enter your email and password.');
      return;
    }

    if (!isSignUp && password.length < 6) {
      Alert.alert('Password too short', 'Password must contain at least 6 characters.');
      return;
    }

    if (isSignUp) {
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[@$!%*?&._\-#+]/.test(password);

      if (password.length < 8) {
        Alert.alert('Password too short', 'Password must contain at least 8 characters.');
        return;
      }
      if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        Alert.alert(
          'Weak password',
          'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character (e.g. @, $, !, %, *, ?, &).'
        );
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
          Alert.alert('Sign up failed', error.message);
          return;
        }

        if (!data.session) {
          Alert.alert(
            'Check your email',
            'Open the verification link sent to your email, then return and sign in.'
          );
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
    <SafeAreaView className="flex-1 bg-brand-navy">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-8 items-center">
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-brand-yellow">
              <Ionicons name="film" size={40} color="#073445" />
            </View>

            <Text className="mt-5 text-3xl font-black text-white">SwipeLog</Text>

            <Text className="mt-2 text-center text-sm font-semibold text-brand-grayText">
              {isSignUp
                ? 'Create an account and keep your movie journey synced.'
                : 'Sign in to continue your movie journey.'}
            </Text>
          </View>

          <View className="gap-4 rounded-3xl border border-white/10 bg-brand-navyLight p-5">
            <View className="gap-2">
              <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                Email
              </Text>

              <View className="h-12 flex-row items-center rounded-xl border border-white/10 bg-brand-navy px-3">
                <Ionicons name="mail-outline" size={18} color="#A0AEC0" />

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="ml-3 flex-1 text-sm font-semibold text-white"
                />
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                Password
              </Text>

              <View className="h-12 flex-row items-center rounded-xl border border-white/10 bg-brand-navy px-3">
                <Ionicons name="lock-closed-outline" size={18} color="#A0AEC0" />

                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!passwordVisible}
                  className="ml-3 flex-1 text-sm font-semibold text-white"
                />

                <Pressable
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setPasswordVisible((current) => !current)}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color="#A0AEC0"
                  />
                </Pressable>
              </View>
            </View>

            {isSignUp ? (
              <View className="gap-2">
                <Text className="text-[10px] font-black uppercase tracking-wider text-brand-grayText">
                  Confirm Password
                </Text>

                <View className="h-12 flex-row items-center rounded-xl border border-white/10 bg-brand-navy px-3">
                  <Ionicons name="shield-checkmark-outline" size={18} color="#A0AEC0" />

                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Enter your password again"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry={!passwordVisible}
                    className="ml-3 flex-1 text-sm font-semibold text-white"
                  />
                </View>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={isSignUp ? 'Create account' : 'Sign in'}
              className="mt-2 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-yellow"
              disabled={loading}
              onPress={handleSubmit}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#073445" />
              ) : (
                <Ionicons
                  name={isSignUp ? 'person-add-outline' : 'log-in-outline'}
                  size={20}
                  color="#073445"
                />
              )}

              <Text className="text-sm font-black text-brand-navy">
                {loading
                  ? 'Please wait...'
                  : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
              </Text>
            </Pressable>
          </View>

          <View className="mt-6 flex-row items-center justify-center">
            <Text className="text-xs font-semibold text-brand-grayText">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            </Text>

            <Pressable
              hitSlop={8}
              onPress={() => {
                setIsSignUp((current) => !current);
                setConfirmPassword('');
              }}
            >
              <Text className="ml-1 text-xs font-black text-brand-yellow">
                {isSignUp ? 'Sign in' : 'Sign up'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}