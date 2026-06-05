import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { logger } from './logger';

const expo = new Expo();

export const sendPushNotifications = async (tokens: string[], title: string, body: string, data?: Record<string, string | number | boolean>, channelId?: string) => {
  const messages: ExpoPushMessage[] = [];

  for (let pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      logger.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }
    messages.push({
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data ?? {},
      channelId,
    });
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
