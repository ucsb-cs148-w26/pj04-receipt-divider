import { Camera, Settings } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

interface HomePageProps {
  onCameraClick: () => void;
  onSettingsClick: () => void;
}

export function HomePage({
  onCameraClick,
  onSettingsClick,
}: HomePageProps) {
  return (
    <View style={styles.container}>
      {/* Settings button - top right */}
      <Pressable
        onPress={onSettingsClick}
        accessibilityLabel="Settings"
        style={({ pressed }) => [
          styles.settingsButton,
          pressed && styles.pressed,
        ]}
      >
        <Settings size={24} color="#374151" />
      </Pressable>

      {/* Camera button - center */}
      <View style={styles.center}>
        <Pressable
          onPress={onCameraClick}
          accessibilityLabel="Open camera"
          style={({ pressed }) => [
            styles.cameraButton,
            pressed && styles.pressed,
          ]}
        >
          <Camera size={64} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6', // gray-100
  },
  settingsButton: {
    zIndex: 999,
    position: 'absolute',
    top: 24,
    right: 24,
    padding: 12,
    borderRadius: 999,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    zIndex: 999,
    padding: 32,
    borderRadius: 999,
    backgroundColor: '#3b82f6', // blue-500
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
});