import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@eezy-receipt/shared';
import { useAuth } from '@/providers';

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (isSignUpMode) {
        await signUpWithEmail(email.trim(), password);
        Alert.alert(
          'Account created',
          'If email confirmation is enabled, check your inbox to verify your account.',
        );
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to authenticate.';
      Alert.alert('Authentication error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsSubmitting(true);
      await signInWithGoogle();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Google sign-in failed.';
      Alert.alert('Google sign-in error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>
          Sign in with email or continue with Google.
        </Text>

        <TextInput
          style={styles.input}
          autoCapitalize='none'
          autoCorrect={false}
          keyboardType='email-address'
          placeholder='Email'
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder='Password'
          value={password}
          onChangeText={setPassword}
        />

        <Button onPress={handleEmailAuth} disabled={isSubmitting}>
          {isSignUpMode ? 'Create account' : 'Sign in'}
        </Button>

        <Button variant='outlined' onPress={handleGoogleLogin} disabled={isSubmitting}>
          Continue with Google
        </Button>

        <Button
          variant='secondary'
          onPress={() => setIsSignUpMode((prev) => !prev)}
          disabled={isSubmitting}
        >
          {isSignUpMode ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
});
