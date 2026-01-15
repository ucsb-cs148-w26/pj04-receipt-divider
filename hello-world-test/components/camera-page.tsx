import { ArrowLeft, Camera } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CameraPageProps {
  onBack: () => void;
  onTakePicture: () => void;
}

export function CameraPage({ onBack, onTakePicture }: CameraPageProps) {
  return (
    <View style={styles.container}>
      {/* Return button - top left */}
      <Pressable
        onPress={onBack}
        accessibilityLabel="Go back"
        style={({ pressed }) => [
          styles.backButton,
          pressed && styles.pressed,
        ]}
      >
        <ArrowLeft size={24} color="#ffffff" />
      </Pressable>

      {/* Camera viewfinder area */}
      <View style={styles.viewfinder}>
        <View style={styles.placeholder}>
          <Camera size={96} color="rgba(255, 255, 255, 0.5)" />
          <Text style={styles.placeholderText}>Camera Preview</Text>
        </View>
      </View>

      {/* Take picture button - middle bottom */}
      <View style={styles.captureButtonContainer}>
        <Pressable
          onPress={onTakePicture}
          accessibilityLabel="Take picture"
          style={({ pressed }) => [
            styles.captureButton,
            pressed && styles.captureButtonPressed,
          ]}
        >
          <View style={styles.captureButtonInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // gray-900
  },
  backButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 999,
    padding: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    borderColor: '#d1d5db', // gray-300
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  captureButtonPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#f3f4f6', // gray-100
  },
  captureButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#111827', // gray-900
  },
});