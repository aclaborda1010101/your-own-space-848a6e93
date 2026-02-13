import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

export class PushNotificationService {
  static async initialize() {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only available on native platforms');
      return;
    }

    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      await PushNotifications.register();
      console.log('Push notifications registered');
    } else {
      console.log('Push notification permission denied');
    }

    // Listeners
    await PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Send token to Supabase
      this.sendTokenToBackend(token.value);
    });

    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error: ', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
      // Handle foreground notification
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed', notification);
      // Handle notification tap
    });
  }

  private static async sendTokenToBackend(token: string) {
    // TODO: Send to Supabase user_devices table
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_devices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            device_token: token,
            platform: 'ios',
            updated_at: new Date().toISOString()
          })
        }
      );
      console.log('Token sent to backend:', response.ok);
    } catch (error) {
      console.error('Error sending token to backend:', error);
    }
  }

  static async sendTestNotification() {
    // For testing - trigger from UI
    await PushNotifications.createChannel({
      id: 'jarvis-ai',
      name: 'Jarvis AI Notifications',
      description: 'Proactive AI assistant notifications',
      importance: 5,
      visibility: 1
    });
  }
}
