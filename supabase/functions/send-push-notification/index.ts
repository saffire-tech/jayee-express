import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
}

interface NotificationRequest {
  user_id: string;
  notification: PushPayload;
}

// Get OAuth 2.0 access token for FCM v1 API
async function getAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Create JWT header and claim
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
  };

  // Base64URL encode
  const base64url = (input: string) => {
    return btoa(input)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  // Import the private key
  const pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the JWT
  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = base64url(
    String.fromCharCode(...new Uint8Array(signatureBytes))
  );

  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Send notification via FCM v1 API (for native apps)
async function sendFCMNotification(
  token: string,
  payload: PushPayload,
  projectId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const message = {
      message: {
        token: token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        android: {
          notification: {
            icon: 'ic_notification',
            color: '#f97316', // Orange accent color
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        data: payload.data ? Object.fromEntries(
          Object.entries(payload.data).map(([k, v]) => [k, String(v)])
        ) : undefined,
      },
    };

    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('FCM send error:', error);
      return false;
    }

    console.log('FCM notification sent successfully to token:', token.substring(0, 20) + '...');
    return true;
  } catch (error) {
    console.error('Error sending FCM notification:', error);
    return false;
  }
}

// Send notification via Web Push (for browsers)
async function sendWebPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const webPush = await import("https://esm.sh/web-push@3.6.7");
    
    webPush.setVapidDetails(
      'mailto:support@uniplug.app',
      vapidPublicKey,
      vapidPrivateKey
    );

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await webPush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    console.log('Web push notification sent successfully to:', subscription.endpoint);
    return true;
  } catch (error) {
    console.error('Error sending web push notification:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const firebaseProjectId = Deno.env.get('FIREBASE_PROJECT_ID');
    const firebaseClientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
    const firebasePrivateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { user_id, notification } = await req.json() as NotificationRequest;

    if (!user_id || !notification) {
      return new Response(
        JSON.stringify({ error: 'user_id and notification are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending notification to user:', user_id);
    console.log('Notification payload:', notification);

    let webSuccessCount = 0;
    let webFailedCount = 0;
    let nativeSuccessCount = 0;
    let nativeFailedCount = 0;

    // Send to Web Push subscriptions
    if (vapidPublicKey && vapidPrivateKey) {
      const { data: webSubscriptions, error: webError } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', user_id);

      if (webError) {
        console.error('Error fetching web subscriptions:', webError);
      } else if (webSubscriptions && webSubscriptions.length > 0) {
        console.log(`Found ${webSubscriptions.length} web push subscriptions`);
        
        const failedEndpoints: string[] = [];

        for (const subscription of webSubscriptions) {
          const success = await sendWebPushNotification(
            subscription,
            {
              ...notification,
              icon: notification.icon || '/icons/icon-192x192.png',
              badge: notification.badge || '/icons/icon-72x72.png',
            },
            vapidPublicKey,
            vapidPrivateKey
          );

          if (success) {
            webSuccessCount++;
          } else {
            webFailedCount++;
            failedEndpoints.push(subscription.endpoint);
          }
        }

        // Clean up failed web subscriptions
        if (failedEndpoints.length > 0) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user_id)
            .in('endpoint', failedEndpoints);
          
          console.log('Cleaned up failed web subscriptions:', failedEndpoints.length);
        }
      }
    } else {
      console.log('Web push not configured (VAPID keys missing)');
    }

    // Send to native devices via FCM
    if (firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
      const { data: deviceTokens, error: tokensError } = await supabase
        .from('device_tokens')
        .select('token, platform')
        .eq('user_id', user_id);

      if (tokensError) {
        console.error('Error fetching device tokens:', tokensError);
      } else if (deviceTokens && deviceTokens.length > 0) {
        console.log(`Found ${deviceTokens.length} native device tokens`);

        try {
          // Get OAuth access token
          const accessToken = await getAccessToken(firebaseClientEmail, firebasePrivateKey);
          console.log('Got FCM access token');

          const failedTokens: string[] = [];

          for (const device of deviceTokens) {
            const success = await sendFCMNotification(
              device.token,
              notification,
              firebaseProjectId,
              accessToken
            );

            if (success) {
              nativeSuccessCount++;
            } else {
              nativeFailedCount++;
              failedTokens.push(device.token);
            }
          }

          // Clean up failed device tokens
          if (failedTokens.length > 0) {
            await supabase
              .from('device_tokens')
              .delete()
              .eq('user_id', user_id)
              .in('token', failedTokens);
            
            console.log('Cleaned up failed device tokens:', failedTokens.length);
          }
        } catch (error) {
          console.error('FCM authentication error:', error);
        }
      }
    } else {
      console.log('FCM not configured (Firebase credentials missing)');
    }

    const totalSent = webSuccessCount + nativeSuccessCount;
    const totalFailed = webFailedCount + nativeFailedCount;

    // Log notification to database
    const notificationData = notification.data || {};
    const { error: logError } = await supabase
      .from("notifications")
      .insert({
        user_id: user_id,
        type: (notificationData as Record<string, unknown>).type || "general",
        channel: "push",
        title: notification.title,
        body: notification.body,
        data: notificationData,
        is_read: false,
      });

    if (logError) {
      console.error("Error logging notification:", logError);
    }

    console.log(`Notification delivery complete: ${totalSent} sent, ${totalFailed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: totalSent,
        failed: totalFailed,
        details: {
          web: { sent: webSuccessCount, failed: webFailedCount },
          native: { sent: nativeSuccessCount, failed: nativeFailedCount },
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-push-notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
