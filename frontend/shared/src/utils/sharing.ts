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
 * Generate a room invite message with the given room ID, group name, and invite URL.
 */
const DEFAULT_APP_URL =
  process.env.EXPO_PUBLIC_APP_URL ??
  'https://testflight.apple.com/join/8bhMpGgZ';

export function getRoomInviteMessage(
  roomId: string,
  groupName: string,
  url: string,
  testflightLink: string = DEFAULT_APP_URL,
): string {
  const roomLabel = groupName ? `"${groupName}"` : 'my';
  return `Join the ${roomLabel} Eezy Receipt room!\n\nRoom ID: ${roomId}\n\nTap to join on Web:\n${url}\n\nOr download the APP here:\n${testflightLink}`;
}

/**
 * Send a room invite SMS for the given room ID, group name, and invite URL.
 */
export async function sendRoomInviteSMS(
  roomId: string,
  groupName: string,
  url: string,
  testflightLink: string = DEFAULT_APP_URL,
): Promise<'sent' | 'cancelled' | 'unknown' | 'unavailable'> {
  return sendSMS(getRoomInviteMessage(roomId, groupName, url, testflightLink));
}
