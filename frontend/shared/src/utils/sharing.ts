import * as SMS from 'expo-sms';
import { Alert } from 'react-native';

let smsSending = false;

/**
 * Send an SMS message. Checks availability first and shows an alert if unavailable.
 * Guards against concurrent calls to avoid "SMS sending in progress" errors.
 */
export async function sendSMS(
  message: string,
): Promise<'sent' | 'cancelled' | 'unknown' | 'unavailable'> {
  if (smsSending) return 'unknown';
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('SMS not available', 'SMS is not available on this device.');
    return 'unavailable';
  }
  smsSending = true;
  try {
    const { result } = await SMS.sendSMSAsync([], message);
    return result;
  } finally {
    smsSending = false;
  }
}

/**
 * Generate a room invite message with the given room ID.
 */
export function getRoomInviteMessage(roomId: string): string {
  return `Join my Eezy Receipt room!\n\nRoom ID: ${roomId}\n\nOr tap this link to join: https://example.com/join?roomId=${roomId}`;
}

/**
 * Send a room invite SMS for the given room ID.
 */
export async function sendRoomInviteSMS(
  roomId: string,
): Promise<'sent' | 'cancelled' | 'unknown' | 'unavailable'> {
  return sendSMS(
    `Join my Eezy Receipt room!\n\nRoom ID: ${roomId}\n\nOr tap this link to join: https://example.com/join?roomId=${roomId}`,
  );
}
