import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { VAPID_PUBLIC_KEY, isPushConfigured } from '@/config/push';
import { useNativePushNotifications } from './useNativePushNotifications';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'default';
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission | 'default'>;
}

// Web Push implementation hook
const useWebPushNotifications = (): PushNotificationState => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);

  const isSupported = 'serviceWorker' in navigator && 
                      'PushManager' in window && 
                      'Notification' in window &&
                      isPushConfigured();

  const ensureSubscriptionSaved = useCallback(
    async (subscription: PushSubscription) => {
      if (!user) return;

      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error('Failed to read subscription keys');
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (error) throw error;
    },
    [user]
  );

  // Check current subscription status
  useEffect(() => {
    if (!isSupported) return;

    setPermission(Notification.permission);

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await ensureSubscriptionSaved(subscription);
          setIsSubscribed(true);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('Error checking push subscription:', error);
      }
    };

    checkSubscription();
  }, [isSupported, ensureSubscriptionSaved]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'denied';
    
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    console.log('[WebPush] Subscribe called, isSupported:', isSupported, 'user:', user?.id);
    
    if (!isSupported || !user) {
      toast({
        title: "Push notifications not available",
        description: "Please make sure you're logged in and using a supported browser.",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);

    try {
      let currentPermission = permission;
      if (currentPermission === 'default') {
        currentPermission = await requestPermission();
      }

      if (currentPermission !== 'granted') {
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        });
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as BufferSource,
      });

      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!p256dh || !auth) {
        throw new Error('Failed to get subscription keys');
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          },
          { onConflict: 'user_id,endpoint' }
        )
        .select();

      if (error) throw error;

      setIsSubscribed(true);
      toast({
        title: "Notifications enabled",
        description: "You'll now receive push notifications for new messages and orders.",
      });
      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      const message = error instanceof Error ? error.message : 'Please try again later.';
      toast({
        title: "Failed to enable notifications",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, permission, requestPermission, toast]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      toast({
        title: "Notifications disabled",
        description: "You won't receive push notifications anymore.",
      });
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        title: "Failed to disable notifications",
        description: "Please try again later.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, toast]);

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe,
    requestPermission,
  };
};

// Unified hook that automatically selects the right implementation
export const usePushNotifications = (): PushNotificationState => {
  const isNative = Capacitor.isNativePlatform();
  const nativePush = useNativePushNotifications();
  const webPush = useWebPushNotifications();
  const { user } = useAuth();

  const push = isNative ? nativePush : webPush;

  // Auto-subscribe when user is authenticated and not yet subscribed
  useEffect(() => {
    if (!user || !push.isSupported || push.isSubscribed || push.isLoading) return;

    // Small delay to let the app settle
    const timer = setTimeout(() => {
      console.log(`[Push] Auto-subscribing (${isNative ? 'native' : 'web'}) for user:`, user.id);
      push.subscribe();
    }, 2000);

    return () => clearTimeout(timer);
    // Only run when user/subscription status changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, push.isSupported, push.isSubscribed]);

  return push;
};
