import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface NativePushState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: 'granted' | 'denied' | 'default';
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<'granted' | 'denied' | 'default'>;
}

export const useNativePushNotifications = (): NativePushState => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);

  const isSupported = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // Save token to database
  const saveToken = useCallback(async (token: string) => {
    if (!user) return;

    console.log('[NativePush] Saving token for user:', user.id, 'platform:', platform);

    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        {
          user_id: user.id,
          token,
          platform,
          device_info: {
            saved_at: new Date().toISOString(),
          },
        },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('[NativePush] Failed to save token:', error);
      throw error;
    }

    console.log('[NativePush] Token saved successfully');
    setCurrentToken(token);
    setIsSubscribed(true);
  }, [user, platform]);

  // Remove token from database
  const removeToken = useCallback(async (token: string) => {
    if (!user) return;

    console.log('[NativePush] Removing token for user:', user.id);

    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', token);

    if (error) {
      console.error('[NativePush] Failed to remove token:', error);
      throw error;
    }

    setCurrentToken(null);
    setIsSubscribed(false);
  }, [user]);

  // Initialize and check existing registration
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkRegistration = async () => {
      try {
        const permStatus = await PushNotifications.checkPermissions();
        console.log('[NativePush] Permission status:', permStatus.receive);

        if (permStatus.receive === 'granted') {
          setPermission('granted');
          
          // Check if we have a token in the database
          const { data } = await supabase
            .from('device_tokens')
            .select('token')
            .eq('user_id', user.id)
            .eq('platform', platform)
            .maybeSingle();

          if (data?.token) {
            setCurrentToken(data.token);
            setIsSubscribed(true);
          }
        } else if (permStatus.receive === 'denied') {
          setPermission('denied');
        }
      } catch (error) {
        console.error('[NativePush] Error checking registration:', error);
      }
    };

    checkRegistration();
  }, [isSupported, user, platform]);

  // Set up push notification listeners
  useEffect(() => {
    if (!isSupported) return;

    // Registration success - save the token
    const registrationListener = PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[NativePush] Registration successful, token:', token.value.substring(0, 20) + '...');
      try {
        await saveToken(token.value);
      } catch (error) {
        console.error('[NativePush] Failed to save token after registration:', error);
      }
    });

    // Registration error
    const errorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('[NativePush] Registration error:', error);
      toast({
        title: "Push notification error",
        description: "Failed to register for push notifications.",
        variant: "destructive",
      });
    });

    // Notification received in foreground
    const foregroundListener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[NativePush] Notification received:', notification);
      // Show a toast for foreground notifications
      toast({
        title: notification.title || 'New Notification',
        description: notification.body || '',
      });
    });

    // Notification tapped - handle deep linking
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      console.log('[NativePush] Notification action performed:', notification);
      
      const data = notification.notification.data;
      if (data?.url && typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//')) {
        // Only allow same-origin relative paths to prevent open redirects
        window.location.href = data.url;
      } else if (data?.type === 'new_message') {
        window.location.href = '/messages';
      } else if (data?.type === 'new_order') {
        window.location.href = '/seller';
      } else if (data?.type === 'order_update' && data?.order_id) {
        window.location.href = '/purchases';
      }
    });

    // Cleanup listeners on unmount
    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      foregroundListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [isSupported, saveToken, toast]);

  const requestPermission = useCallback(async (): Promise<'granted' | 'denied' | 'default'> => {
    if (!isSupported) return 'denied';

    try {
      const result = await PushNotifications.requestPermissions();
      console.log('[NativePush] Permission request result:', result.receive);
      
      if (result.receive === 'granted') {
        setPermission('granted');
        return 'granted';
      } else {
        setPermission('denied');
        return 'denied';
      }
    } catch (error) {
      console.error('[NativePush] Permission request error:', error);
      return 'denied';
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    console.log('[NativePush] Subscribe called, isSupported:', isSupported, 'user:', user?.id);

    if (!isSupported || !user) {
      toast({
        title: "Push notifications not available",
        description: "Please make sure you're logged in.",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);

    try {
      // Request permission if not granted
      let currentPermission = permission;
      if (currentPermission !== 'granted') {
        currentPermission = await requestPermission();
      }

      if (currentPermission !== 'granted') {
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your device settings.",
          variant: "destructive",
        });
        return false;
      }

      // Register with FCM
      console.log('[NativePush] Registering with FCM...');
      await PushNotifications.register();

      // The token will be saved by the 'registration' event listener
      toast({
        title: "Notifications enabled",
        description: "You'll now receive push notifications for new messages and orders.",
      });
      
      return true;
    } catch (error) {
      console.error('[NativePush] Subscribe error:', error);
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
    if (!isSupported || !user || !currentToken) return false;

    setIsLoading(true);

    try {
      await removeToken(currentToken);
      
      toast({
        title: "Notifications disabled",
        description: "You won't receive push notifications anymore.",
      });
      return true;
    } catch (error) {
      console.error('[NativePush] Unsubscribe error:', error);
      toast({
        title: "Failed to disable notifications",
        description: "Please try again later.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, currentToken, removeToken, toast]);

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
