import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
      className='bg-background flex-1 items-center justify-center p-4'
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className='bg-surface w-full max-w-[420px] rounded-xl p-5 gap-3'>
        <Text className='text-foreground text-2xl font-bold'>Welcome</Text>
        <Text className='text-muted-foreground mb-1'>
          Sign in with email or continue with Google.
        </Text>

        <TextInput
          className='bg-surface-elevated text-foreground rounded-[10px] px-3 py-[10px] text-base'
          autoCapitalize='none'
          autoCorrect={false}
          keyboardType='email-address'
          placeholder='Email'
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          className='bg-surface-elevated text-foreground rounded-[10px] px-3 py-[10px] text-base'
          secureTextEntry
          placeholder='Password'
          value={password}
          onChangeText={setPassword}
        />

        <Button
          variant='primary'
          onPress={handleEmailAuth}
          disabled={isSubmitting}
        >
          {isSignUpMode ? 'Create account' : 'Sign in'}
        </Button>

        <Button
          variant='primary'
          onPress={handleGoogleLogin}
          disabled={isSubmitting}
        >
          Continue with Google
        </Button>

        <Button
          variant='primary'
          onPress={() => setIsSignUpMode((prev) => !prev)}
          disabled={isSubmitting}
        >
          {isSignUpMode
            ? 'Already have an account? Sign in'
            : 'Need an account? Sign up'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
