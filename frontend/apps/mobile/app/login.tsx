import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  ScrollableTextInput,
  useScrollToInput,
} from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers';
import Icon from '../assets/images/icon.svg';
import GoogleLogo from '../assets/images/google-logo.svg';

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollCtx = useScrollToInput({
    // true: scroll returns to y=0 and bottom padding collapses when keyboard closes.
    // false: scroll position stays put and padding is always present.
    resetOnBlur: true,
  });

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

  // Animate width/height instead of transform:scale so the SVG re-renders its
  // vector paths at the new size each frame — no bitmap rasterization/pixelation.
  const BASE_CIRCLE = Dimensions.get('window').width * 0.4;
  const SCREEN_H = Dimensions.get('window').height;
  const circleSize = scrollY.interpolate({
    inputRange: [-100, 0, 300],
    outputRange: [BASE_CIRCLE * 1.5, BASE_CIRCLE, BASE_CIRCLE * 0.5],
    extrapolate: 'clamp',
  });
  const iconSize = scrollY.interpolate({
    inputRange: [-100, 0, 300],
    outputRange: [215, 128, 77],
    extrapolate: 'clamp',
  });
  const logoFontSize = scrollY.interpolate({
    inputRange: [-100, 0, 300],
    outputRange: [38, 30, 20],
    extrapolate: 'clamp',
  });

  return (
    <View className='bg-background flex-1'>
      <Animated.ScrollView
        ref={scrollCtx.scrollViewRef}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: (e: any) => scrollCtx.trackScrollOffset(e),
          },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode='on-drag'
        keyboardShouldPersistTaps='handled'
        onContentSizeChange={scrollCtx.onContentSizeChange}
        style={{ flex: 1 }}
        contentContainerStyle={{
          // paddingBottom is required — without overflow scrollTo() is a no-op.
          // See SCROLL_TO_INPUT_BOTTOM_PADDING in useScrollToInput for details.
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: SCREEN_H * 0.08,
          paddingBottom: scrollCtx.bottomPadding,
        }}
      >
        {/* Logo + title */}
        <Animated.View style={{ alignItems: 'center', marginBottom: 30 }}>
          <Animated.View
            className='bg-secondary-background'
            style={{
              borderRadius: 9999,
              width: circleSize,
              height: circleSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Animated.View style={{ width: iconSize, height: iconSize }}>
              <Icon width='100%' height='100%' />
            </Animated.View>
          </Animated.View>
          <Animated.Text
            className='text-primary font-bold mt-4'
            style={{ fontSize: logoFontSize }}
          >
            Eezy Receipt
          </Animated.Text>
        </Animated.View>

        <View className='w-full max-w-[420px] gap-3'>
          {/* Google sign-in */}
          <TouchableOpacity
            className='bg-secondary-background border border-border rounded-xl py-3.5 flex-row items-center justify-center gap-2.5'
            onPress={handleGoogleLogin}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <GoogleLogo width={20} height={20} />
            <Text className='text-foreground font-semibold text-base'>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* OR divider */}
          <View className='flex-row items-center my-0.5'>
            <View className='flex-1 h-px bg-border' />
            <Text className='text-muted-foreground text-sm'>or</Text>
            <View className='flex-1 h-px bg-border' />
          </View>

          {/* Email section label */}
          <Text className='text-foreground font-medium text-sm -mb-1'>
            {isSignUpMode ? 'Sign up with email' : 'Login with email'}
          </Text>

          {/* Email input */}
          <ScrollableTextInput
            scrollContext={scrollCtx}
            name='email'
            className='bg-secondary-background text-foreground rounded-xl px-4 py-3 mb-[-4px] text-base border border-border'
            autoCapitalize='none'
            autoCorrect={false}
            keyboardType='email-address'
            placeholder='Email'
            placeholderTextColor='#9ca3af'
            value={email}
            onChangeText={setEmail}
          />

          {/* Password input */}
          <ScrollableTextInput
            scrollContext={scrollCtx}
            name='password'
            className='bg-secondary-background text-foreground rounded-xl px-4 py-3 mb-2 text-base border border-border'
            secureTextEntry
            placeholder='Password'
            placeholderTextColor='#9ca3af'
            value={password}
            onChangeText={setPassword}
          />

          {/* Submit button — blue for login, purple for sign up */}
          <Button
            variant='primary'
            size='large'
            className={isSignUpMode ? 'bg-purple-600' : ''}
            onPress={handleEmailAuth}
            disabled={isSubmitting}
          >
            {isSignUpMode ? 'Sign up' : 'Login'}
          </Button>

          {/* Toggle mode link */}
          <View className='flex-row mt-1'>
            <Text className='text-muted-foreground text-sm'>
              {isSignUpMode
                ? 'Already have an account? '
                : "Don't have an account? "}
            </Text>
            <TouchableOpacity
              onPress={() => setIsSignUpMode((prev) => !prev)}
              disabled={isSubmitting}
            >
              <Text className='text-primary underline underline-offset-2 text-decoration-skip-ink:none text-sm font-semibold'>
                {isSignUpMode ? 'Login' : 'Sign up'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
