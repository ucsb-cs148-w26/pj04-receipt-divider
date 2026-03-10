import { USER_COLORS } from '@shared/constants';
import { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  LayoutRectangle,
  Pressable,
  Alert,
  Animated,
  TextInput,
} from 'react-native';

interface ParticipantsProps {
  id: number;
  name?: string;
  itemCount?: number;
  totalAmount?: string;
  onRemove: () => void;
  onLayout: (event: LayoutRectangle) => void;
  goToYourItemsPage: () => void;
  isEditMode?: boolean;
  /** Called when the participant name is changed; if undefined, name is read-only */
  onRename?: (_newName: string) => void;
}

export function Participant({
  id,
  name,
  itemCount = 0,
  totalAmount = '0.00',
  onRemove,
  onLayout,
  goToYourItemsPage,
  isEditMode = true,
  onRename,
}: ParticipantsProps) {
  const ref = useRef<View>(null);
  const displayName = name || `Name ${id}`;
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);

  // Keep local input in sync when name prop changes externally
  useEffect(() => {
    if (!isEditingName) setNameInput(name || `Name ${id}`);
  }, [name, id, isEditingName]);

  const editAnim = useRef(new Animated.Value(isEditMode ? 1 : 0)).current;
  const claimOpacity = editAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  useEffect(() => {
    Animated.timing(editAnim, {
      toValue: isEditMode ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmRemove = () => {
    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove "${displayName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ],
    );
  };

  return (
    <Pressable
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow((x, y, width, height) => {
          onLayout({ x, y, width, height });
        });
      }}
      className='bg-card rounded-2xl overflow-hidden shadow-sm shadow-black/10'
      style={{ width: 160, height: 100 }}
      onPress={goToYourItemsPage}
    >
      {/* Colored top strip */}
      <View
        className={`h-3 bg-${USER_COLORS[(id - 1) % USER_COLORS.length]}`}
      />

      <View className='px-3 py-3 flex-1 justify-between'>
        <View className='flex-row items-center gap-3'>
          {/* User ID circle — cross-fades ✕ (edit) ↔ number (claim) */}
          <Pressable
            className={`w-9 h-9 rounded-full items-center justify-center bg-${USER_COLORS[(id - 1) % USER_COLORS.length]} ${isEditMode ? 'active:opacity-70' : ''}`}
            onPress={isEditMode ? confirmRemove : undefined}
            accessibilityLabel={isEditMode ? 'Remove participant' : undefined}
            hitSlop={
              isEditMode
                ? { top: 10, bottom: 10, right: 10, left: 10 }
                : undefined
            }
          >
            <Animated.View style={{ position: 'absolute', opacity: editAnim }}>
              <Text className='text-white text-sm font-bold'>✕</Text>
            </Animated.View>
            <Animated.View style={{ opacity: claimOpacity }}>
              <Text className='text-white text-sm font-bold'>{id}</Text>
            </Animated.View>
          </Pressable>

          {/* Name */}
          {isEditMode && onRename && isEditingName ? (
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              returnKeyType='done'
              onSubmitEditing={() => {
                const trimmed = nameInput.trim();
                if (trimmed) onRename(trimmed);
                setIsEditingName(false);
              }}
              onBlur={() => {
                const trimmed = nameInput.trim();
                if (trimmed) onRename(trimmed);
                else setNameInput(displayName);
                setIsEditingName(false);
              }}
              className='text-foreground font-bold text-sm flex-1'
              style={{ padding: 0, includeFontPadding: false }}
              numberOfLines={1}
            />
          ) : (
            <Pressable
              className='flex-1'
              onPress={
                isEditMode && onRename
                  ? () => {
                      setNameInput(displayName);
                      setIsEditingName(true);
                    }
                  : undefined
              }
              disabled={!isEditMode || !onRename}
            >
              <Text
                className={`text-foreground font-bold text-sm${isEditMode && onRename ? ' underline' : ''}`}
                numberOfLines={2}
              >
                {displayName}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Item count and total */}
        <View className='flex-row items-center justify-between'>
          <Text className='text-muted-foreground text-xs'>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} · ${totalAmount}
          </Text>
          <Text className='text-muted-foreground text-base'>›</Text>
        </View>
      </View>
    </Pressable>
  );
}
