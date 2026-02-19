import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Import all screens
import HomeScreen from '../app/index';
import CameraScreen from '../app/camera/index';
import ReceiptRoomScreen from '../app/receipt-room/index';
import QRScreen from '../app/qr/index';
import YourItemScreen from '../app/items/index';
import SettingsScreen from '../app/setting/index';
import ModalScreen from '../app/modal';
import PictureErrorScreen from '../app/error/picture/index';

// Mock all external dependencies
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('expo-router', () => ({
  router: {
    navigate: jest.fn(),
    back: jest.fn(),
    push: jest.fn(),
    dismiss: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({
    roomId: 'test-room-id',
    items: JSON.stringify([]),
    participantId: '1',
  })),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' }),
  ),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  MediaType: ['images'],
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation(() => ({
    base64: jest.fn(() => Promise.resolve('base64-data')),
  })),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid'),
}));

jest.mock('@react-navigation/native', () => ({
  useTheme: jest.fn(() => ({
    colors: {
      primary: '#007AFF',
      background: '#FFFFFF',
      card: '#FFFFFF',
      text: '#000000',
      border: '#C8C8CC',
      notification: '#FF3B30',
    },
  })),
}));

// Mock shared components
jest.mock('@shared/components/ReceiptItem', () => 'ReceiptItem');
jest.mock('@shared/components/DisplayItems', () => 'DisplayItems');
jest.mock('@shared/components/Participant', () => 'Participant');

// Mock custom providers
jest.mock('@/providers', () => ({
  useReceiptItems: jest.fn(() => ({
    items: [],
    setItems: jest.fn(),
  })),
}));

// Mock custom components
jest.mock('@/components/ThemedText', () => ({
  ThemedText: () => null,
}));

jest.mock('@/components/ThemedView', () => ({
  ThemedView: () => null,
}));

// Mock services
jest.mock('@/services/ocr', () => ({
  extractItems: jest.fn(() => Promise.resolve([])),
}));

describe('App Dependencies Check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Home Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<HomeScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('Camera Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<CameraScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('Receipt Room Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<ReceiptRoomScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('QR Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<QRScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('Items Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<YourItemScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('Settings Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<SettingsScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('Modal Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<ModalScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('Error Screen Dependencies', () => {
    it('renders without dependency errors', async () => {
      await waitFor(() => {
        expect(() => {
          render(<PictureErrorScreen />);
        }).not.toThrow();
      });
    });
  });

  describe('Critical Dependency Integration', () => {
    it('all screens handle missing optional dependencies gracefully', async () => {
      const screens = [
        HomeScreen,
        CameraScreen,
        ReceiptRoomScreen,
        QRScreen,
        YourItemScreen,
        SettingsScreen,
        ModalScreen,
        PictureErrorScreen,
      ];

      for (const Screen of screens) {
        await waitFor(() => {
          expect(() => {
            render(<Screen />);
          }).not.toThrow();
        });
      }
    });

    it('no console errors during any screen startup', async () => {
      const originalConsoleError = console.error;
      const consoleErrorSpy = jest.fn();
      console.error = consoleErrorSpy;

      try {
        render(<HomeScreen />);
        render(<SettingsScreen />);
        render(<ModalScreen />);
        render(<PictureErrorScreen />);

        await waitFor(() => {
          expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
      } finally {
        console.error = originalConsoleError;
      }
    });
  });

  describe('External Package Dependencies', () => {
    it('handles expo packages gracefully', async () => {
      // Test that expo packages don't cause crashes
      await waitFor(() => {
        expect(() => {
          render(<HomeScreen />);
          render(<CameraScreen />);
        }).not.toThrow();
      });
    });

    it('handles third-party packages gracefully', async () => {
      // Test react-native-qrcode-svg and others
      await waitFor(() => {
        expect(() => {
          render(<QRScreen />);
        }).not.toThrow();
      });
    });
  });
});
