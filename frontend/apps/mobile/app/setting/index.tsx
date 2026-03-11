import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { DefaultButtons } from '@eezy-receipt/shared';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/providers';
import { supabase } from '@/services/supabase';
import { updateUsername, updateProfileColor } from '@/services/groupApi';

const WHEEL_SIZE = 240;
const CX = WHEEL_SIZE / 2;
const CY = WHEEL_SIZE / 2;
const R_OUTER = 108;
const R_INNER = 72;
const R_MID = (R_OUTER + R_INNER) / 2;
const NUM_SEGMENTS = 72; // 5° each

function polarToCartesian(r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function makeSegmentPath(startAngle: number, endAngle: number): string {
  const s1 = polarToCartesian(R_OUTER, startAngle);
  const e1 = polarToCartesian(R_OUTER, endAngle);
  const s2 = polarToCartesian(R_INNER, endAngle);
  const e2 = polarToCartesian(R_INNER, startAngle);
  return `M ${s1.x} ${s1.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${e1.x} ${e1.y} L ${s2.x} ${s2.y} A ${R_INNER} ${R_INNER} 0 0 0 ${e2.x} ${e2.y} Z`;
}

function hslToHex(h: number): string {
  const s = 1,
    l = 0.5;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHue(hex: string): number {
  if (!hex.startsWith('#') || hex.length < 7) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  if (max === r) h = (((g - b) / d + (g < b ? 6 : 0)) / 6) * 360;
  else if (max === g) h = (((b - r) / d + 2) / 6) * 360;
  else h = (((r - g) / d + 4) / 6) * 360;
  return h;
}

function ColorWheelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const containerRef = useRef<View>(null);

  // Use a ref so the PanResponder closure always calls the latest onChange
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleTouch = (pageX: number, pageY: number) => {
    containerRef.current?.measureInWindow((vx, vy, vw, vh) => {
      const scaleX = WHEEL_SIZE / vw;
      const scaleY = WHEEL_SIZE / vh;
      const localX = (pageX - vx) * scaleX;
      const localY = (pageY - vy) * scaleY;
      const dx = localX - CX;
      const dy = localY - CY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Accept touches slightly outside the ring for better UX
      if (dist < R_INNER - 12 || dist > R_OUTER + 12) return;
      let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angleDeg < 0) angleDeg += 360;
      if (angleDeg >= 360) angleDeg -= 360;
      onChangeRef.current(hslToHex(Math.round(angleDeg)));
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) =>
        handleTouch(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) =>
        handleTouch(e.nativeEvent.pageX, e.nativeEvent.pageY),
    }),
  ).current;

  const hue = hexToHue(value);
  const indicatorPos = polarToCartesian(R_MID, hue);

  return (
    <View
      ref={containerRef}
      style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
      {...panResponder.panHandlers}
    >
      <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
        {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
          const step = 360 / NUM_SEGMENTS;
          const startAngle = i * step;
          const endAngle = startAngle + step + 0.5; // slight overlap to avoid gaps
          const segHue = Math.round(startAngle);
          return (
            <Path
              key={i}
              d={makeSegmentPath(startAngle, endAngle)}
              fill={`hsl(${segHue}, 100%, 50%)`}
            />
          );
        })}
        {/* Selected-color indicator */}
        <Circle
          cx={indicatorPos.x}
          cy={indicatorPos.y}
          r={12}
          fill={value}
          stroke='white'
          strokeWidth={3}
        />
      </Svg>
    </View>
  );
}

// ── Reusable row (top-level to avoid re-mount on parent re-render) ──
function SettingRow({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className='flex-row items-center px-4 py-4 active:opacity-70'
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={destructive ? '#EF4444' : '#9CA3AF'}
      />
      <View className='flex-1 ml-3'>
        <Text
          className={`text-base font-medium ${destructive ? 'text-red-500' : 'text-foreground'}`}
        >
          {label}
        </Text>
        {value ? (
          <Text className='text-sm text-muted-foreground' numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      <MaterialCommunityIcons name='chevron-right' size={20} color='#6B7280' />
    </Pressable>
  );
}

// ── Edit modal shell (top-level to avoid re-mount on parent re-render) ──
function EditModal({
  visible,
  title,
  onClose,
  onSave,
  saving,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType='fade'>
      <Pressable
        className='flex-1 bg-black/50 justify-center items-center'
        onPress={onClose}
      >
        <Pressable
          className='bg-card w-[85%] rounded-2xl p-5'
          onPress={() => {}}
        >
          <Text className='text-foreground text-lg font-bold mb-4'>
            {title}
          </Text>
          {children}
          <View className='flex-row justify-end gap-3 mt-5'>
            <Pressable onPress={onClose} className='px-4 py-2 rounded-lg'>
              <Text className='text-muted-foreground font-medium'>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={saving}
              className='bg-primary px-5 py-2 rounded-lg'
            >
              <Text className='text-white font-medium'>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { signOut, user } = useAuth();

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const email = user?.email ?? '';

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);

  const [newName, setNewName] = useState(fullName);
  const [selectedColor, setSelectedColor] = useState<string>(
    (user?.user_metadata?.accent_color as string | undefined) ?? '#6366F1',
  );
  const [saving, setSaving] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(
    (user?.user_metadata?.accent_color as string | undefined) ?? '#6366F1',
  );
  const [displayName, setDisplayName] = useState(fullName);
  const [refreshing, setRefreshing] = useState(false);

  const displayInitial = (displayName || email || 'U')[0]?.toUpperCase();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('username, accent_color')
          .eq('id', user.id)
          .single();
        if (data?.username) setDisplayName(data.username as string);
        if (data?.accent_color) setAccentColor(data.accent_color as string);
      }
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      // Update auth metadata and profiles table via backend (handles auth + DB atomically)
      const { error } = await supabase.auth.updateUser({
        data: { full_name: newName.trim() },
      });
      if (error) throw error;
      await updateUsername(newName.trim());
      Alert.alert('Success', 'Name updated.');
      setDisplayName(newName.trim());
      setNameModalVisible(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveColor = async () => {
    setSaving(true);
    try {
      // Update auth metadata and profiles table via backend
      const { error } = await supabase.auth.updateUser({
        data: { accent_color: selectedColor },
      });
      if (error) throw error;
      await updateProfileColor(selectedColor);
      Alert.alert('Success', 'Accent color updated.');
      setAccentColor(selectedColor);
      setColorModalVisible(false);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <SafeAreaView className='flex-1 bg-background'>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Profile picture + name */}
        <View className='items-center mt-[10vh] mb-6'>
          <View className='w-24 h-24 rounded-full overflow-hidden mb-3 shadow-md shadow-black/20'>
            <View
              className='w-full h-full items-center justify-center'
              style={{ backgroundColor: accentColor }}
            >
              <Text className='text-white font-bold text-3xl'>
                {displayInitial}
              </Text>
            </View>
          </View>
          <Text className='text-foreground text-xl font-bold'>
            {displayName || 'User'}
          </Text>
          <Text className='text-muted-foreground text-sm'>{email}</Text>
        </View>

        {/* Settings options */}
        <View className='bg-card mx-5 rounded-2xl overflow-hidden'>
          <SettingRow
            icon='account-outline'
            label='Name'
            value={fullName || 'Not set'}
            onPress={() => {
              setNewName(fullName);
              setNameModalVisible(true);
            }}
          />
          <View className='h-px bg-border mx-4' />
          <SettingRow
            icon='palette-outline'
            label='Accent Color'
            onPress={() => setColorModalVisible(true)}
          />
        </View>

        {/* Sign out */}
        <View className='bg-card mx-5 mt-4 rounded-2xl overflow-hidden'>
          <SettingRow
            icon='logout'
            label='Sign Out'
            onPress={handleSignOut}
            destructive
          />
        </View>
      </ScrollView>

      <DefaultButtons.Close onPress={() => router.back()} />

      {/* Name modal */}
      <EditModal
        visible={nameModalVisible}
        title='Change Name'
        onClose={() => setNameModalVisible(false)}
        onSave={handleSaveName}
        saving={saving}
      >
        <TextInput
          className='bg-background text-foreground px-4 py-3 rounded-lg text-base'
          placeholder='Enter your name'
          placeholderTextColor='#9CA3AF'
          value={newName}
          onChangeText={setNewName}
          autoFocus
        />
      </EditModal>

      {/* Color modal */}
      <EditModal
        visible={colorModalVisible}
        title='Choose Accent Color'
        onClose={() => setColorModalVisible(false)}
        onSave={handleSaveColor}
        saving={saving}
      >
        <View className='items-center gap-4'>
          <ColorWheelPicker value={selectedColor} onChange={setSelectedColor} />
          {/* Swatch preview */}
          <View className='flex-row items-center gap-3'>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: selectedColor,
                borderWidth: 2,
                borderColor: '#FFFFFF',
              }}
            />
            <Text className='text-foreground text-base font-mono'>
              {selectedColor.toUpperCase()}
            </Text>
          </View>
        </View>
      </EditModal>
    </SafeAreaView>
  );
}
