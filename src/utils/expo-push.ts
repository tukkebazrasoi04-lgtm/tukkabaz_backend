import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { logger } from './logger';

const expo = new Expo();

export const sendPushNotifications = async (
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string | number | boolean>,
  channelId?: string,
  // iOS notification sound (filename bundled via the expo-notifications plugin,
  // or 'default'). Android sound is governed by the channel, not the payload.
  sound: string = 'default'
) => {
  const messages: ExpoPushMessage[] = [];

  // Order alarms break through Focus modes on iOS via the time-sensitive
  // interruption level (requires the time-sensitive entitlement in the build).
  const isUrgent = channelId === 'urgent-orders-v2';

  for (let pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      logger.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }
    messages.push({
      to: pushToken,
      sound: sound as ExpoPushMessage['sound'],
      title,
      body,
      data: data ?? {},
      channelId,
      priority: 'high',
      ...(isUrgent ? { interruptionLevel: 'time-sensitive' } : {})
    } as ExpoPushMessage);
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (let chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error: any) {
      logger.error("Error sending push notification chunk", error);
    }
  }

  // We could also check receipts here, but it's optional
};
