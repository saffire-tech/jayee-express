import { usePushNotifications } from '@/hooks/usePushNotifications';

export const PushNotificationManager = () => {
  // This hook auto-subscribes when user is authenticated
  usePushNotifications();
  return null;
};
