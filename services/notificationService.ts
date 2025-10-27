import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { OrderStatus } from '@/types';

const WHATSAPP_API_TOKEN = process.env.EXPO_PUBLIC_WHATSAPP_API_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.EXPO_PUBLIC_WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermissions = async (): Promise<string | null> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    if (Platform.OS === 'web') {
      console.log('[Notifications] Push notifications are limited on web');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync();

    console.log('[Notifications] Expo Push Token:', token.data);
    return token.data;
  } catch (error) {
    console.error('[Notifications] Error getting push token:', error);
    return null;
  }
};

export const savePushToken = async (userId: string, token: string): Promise<void> => {
  try {
    await setDoc(
      doc(db, 'pushTokens', userId),
      {
        token,
        userId,
        platform: Platform.OS,
        updatedAt: new Date(),
      },
      { merge: true }
    );
    console.log('[Notifications] Push token saved for user:', userId);
  } catch (error) {
    console.error('[Notifications] Error saving push token:', error);
  }
};

const sendWhatsAppMessage = async (
  phoneNumber: string,
  message: string
): Promise<void> => {
  try {
    if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.error('[WhatsApp] API credentials not configured');
      return;
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    
    if (!cleanPhone) {
      console.error('[WhatsApp] Invalid phone number:', phoneNumber);
      return;
    }

    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message,
        },
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('[WhatsApp] Error sending message:', result);
      throw new Error(result.error?.message || 'Failed to send WhatsApp message');
    }

    console.log('[WhatsApp] Message sent successfully:', result);
  } catch (error: any) {
    console.error('[WhatsApp] Error:', error);
    throw error;
  }
};

const sendPushNotificationToUser = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> => {
  try {
    const tokenDoc = await getDoc(doc(db, 'pushTokens', userId));
    
    if (!tokenDoc.exists()) {
      console.log('[Push] No push token found for user:', userId);
      return;
    }

    const tokenData = tokenDoc.data();
    const pushToken = tokenData?.token;

    if (!pushToken) {
      console.log('[Push] No push token in document for user:', userId);
      return;
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data || {},
      priority: 'high',
      channelId: 'order-updates',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    if (!response.ok || result.data?.status === 'error') {
      console.error('[Push] Error response:', result);
      throw new Error(result.data?.message || 'Failed to send push notification');
    }

    console.log('[Push] Notification sent successfully to user:', userId, result);
  } catch (error: any) {
    console.error('[Push] Error sending push notification:', error);
  }
};

export const sendOrderStatusNotification = async (
  customerId: string,
  orderId: string,
  newStatus: OrderStatus,
  orderNumber: string
): Promise<void> => {
  try {
    const customerDoc = await getDoc(doc(db, 'users', customerId));
    
    if (!customerDoc.exists()) {
      console.log('[Notifications] No customer found:', customerId);
      return;
    }

    const customerData = customerDoc.data();
    const customerPhone = customerData?.phone;
    
    if (!customerPhone) {
      console.log('[Notifications] No phone number for customer:', customerId);
    }

    const statusMessages: Record<OrderStatus, { 
      whatsappEn: string; 
      whatsappAr: string;
      pushTitleEn: string;
      pushTitleAr: string;
      pushBodyEn: string;
      pushBodyAr: string;
    }> = {
      received: {
        whatsappEn: `✅ *Order Received*\n\nYour order #${orderNumber} has been received and is being processed.\n\nThank you for shopping with us!`,
        whatsappAr: `✅ *تم استلام الطلب*\n\nتم استلام طلبك #${orderNumber} وجاري معالجته.\n\nشكراً لتسوقك معنا!`,
        pushTitleEn: '✅ Order Received',
        pushTitleAr: '✅ تم استلام الطلب',
        pushBodyEn: `Your order #${orderNumber} has been received and is being processed.`,
        pushBodyAr: `تم استلام طلبك #${orderNumber} وجاري معالجته.`,
      },
      under_review: {
        whatsappEn: `🔍 *Order Under Review*\n\nYour order #${orderNumber} is currently under review by our team.\n\nWe'll notify you once it's approved.`,
        whatsappAr: `🔍 *الطلب قيد المراجعة*\n\nطلبك #${orderNumber} قيد المراجعة من قبل فريقنا.\n\nسنقوم بإشعارك بمجرد الموافقة عليه.`,
        pushTitleEn: '🔍 Order Under Review',
        pushTitleAr: '🔍 الطلب قيد المراجعة',
        pushBodyEn: `Your order #${orderNumber} is currently under review.`,
        pushBodyAr: `طلبك #${orderNumber} قيد المراجعة من قبل فريقنا.`,
      },
      preparing: {
        whatsappEn: `📦 *Order Being Prepared*\n\nGreat news! Your order #${orderNumber} is being prepared for shipment.\n\nIt will be on its way soon!`,
        whatsappAr: `📦 *جاري تحضير الطلب*\n\nأخبار سارة! جاري تحضير طلبك #${orderNumber} للشحن.\n\nسيكون في الطريق قريباً!`,
        pushTitleEn: '📦 Order Being Prepared',
        pushTitleAr: '📦 جاري تحضير الطلب',
        pushBodyEn: `Your order #${orderNumber} is being prepared for shipment!`,
        pushBodyAr: `جاري تحضير طلبك #${orderNumber} للشحن!`,
      },
      shipped: {
        whatsappEn: `🚚 *Order Shipped*\n\nYour order #${orderNumber} has been shipped and is on its way to you!\n\nExpected delivery soon.`,
        whatsappAr: `🚚 *تم شحن الطلب*\n\nتم شحن طلبك #${orderNumber} وهو في الطريق إليك!\n\nالتوصيل المتوقع قريباً.`,
        pushTitleEn: '🚚 Order Shipped',
        pushTitleAr: '🚚 تم شحن الطلب',
        pushBodyEn: `Your order #${orderNumber} has been shipped and is on its way!`,
        pushBodyAr: `تم شحن طلبك #${orderNumber} وهو في الطريق إليك!`,
      },
      arrived_hub: {
        whatsappEn: `🏢 *Order Arrived at Hub*\n\nYour order #${orderNumber} has arrived at our distribution hub.\n\nIt will be out for delivery soon!`,
        whatsappAr: `🏢 *وصل الطلب إلى المركز*\n\nوصل طلبك #${orderNumber} إلى مركز التوزيع.\n\nسيتم توصيله قريباً!`,
        pushTitleEn: '🏢 Order Arrived at Hub',
        pushTitleAr: '🏢 وصل الطلب إلى المركز',
        pushBodyEn: `Your order #${orderNumber} has arrived at our hub!`,
        pushBodyAr: `وصل طلبك #${orderNumber} إلى مركز التوزيع!`,
      },
      out_for_delivery: {
        whatsappEn: `🛵 *Out for Delivery*\n\nExciting news! Your order #${orderNumber} is out for delivery and will arrive soon!\n\nPlease be available to receive it.`,
        whatsappAr: `🛵 *في طريقه للتوصيل*\n\nأخبار مثيرة! طلبك #${orderNumber} في طريقه للتوصيل وسيصل قريباً!\n\nيرجى التواجد لاستلامه.`,
        pushTitleEn: '🛵 Out for Delivery',
        pushTitleAr: '🛵 في طريقه للتوصيل',
        pushBodyEn: `Your order #${orderNumber} is out for delivery!`,
        pushBodyAr: `طلبك #${orderNumber} في طريقه للتوصيل!`,
      },
      delivered: {
        whatsappEn: `✨ *Order Delivered*\n\nYour order #${orderNumber} has been delivered successfully!\n\nThank you for shopping with us. We hope to serve you again!`,
        whatsappAr: `✨ *تم توصيل الطلب*\n\nتم توصيل طلبك #${orderNumber} بنجاح!\n\nشكراً لتسوقك معنا. نتمنى أن نخدمك مرة أخرى!`,
        pushTitleEn: '✨ Order Delivered',
        pushTitleAr: '✨ تم توصيل الطلب',
        pushBodyEn: `Your order #${orderNumber} has been delivered successfully!`,
        pushBodyAr: `تم توصيل طلبك #${orderNumber} بنجاح!`,
      },
      cancelled: {
        whatsappEn: `❌ *Order Cancelled*\n\nYour order #${orderNumber} has been cancelled.\n\nIf you have any questions, please contact our support team.`,
        whatsappAr: `❌ *تم إلغاء الطلب*\n\nتم إلغاء طلبك #${orderNumber}.\n\nإذا كان لديك أي أسئلة، يرجى التواصل مع فريق الدعم.`,
        pushTitleEn: '❌ Order Cancelled',
        pushTitleAr: '❌ تم إلغاء الطلب',
        pushBodyEn: `Your order #${orderNumber} has been cancelled.`,
        pushBodyAr: `تم إلغاء طلبك #${orderNumber}.`,
      },
      delivery_failed: {
        whatsappEn: `⚠️ *Delivery Failed*\n\nWe couldn't deliver your order #${orderNumber}.\n\nPlease contact our support team to reschedule delivery.`,
        whatsappAr: `⚠️ *فشل التوصيل*\n\nلم نتمكن من توصيل طلبك #${orderNumber}.\n\nيرجى التواصل مع فريق الدعم لإعادة جدولة التوصيل.`,
        pushTitleEn: '⚠️ Delivery Failed',
        pushTitleAr: '⚠️ فشل التوصيل',
        pushBodyEn: `We couldn't deliver your order #${orderNumber}.`,
        pushBodyAr: `لم نتمكن من توصيل طلبك #${orderNumber}.`,
      },
      awaiting_payment: {
        whatsappEn: `💳 *Payment Required*\n\nYour order #${orderNumber} is awaiting payment.\n\nPlease complete the payment to proceed with your order.`,
        whatsappAr: `💳 *مطلوب الدفع*\n\nطلبك #${orderNumber} بانتظار الدفع.\n\nيرجى إتمام الدفع لمتابعة طلبك.`,
        pushTitleEn: '💳 Payment Required',
        pushTitleAr: '💳 مطلوب الدفع',
        pushBodyEn: `Your order #${orderNumber} is awaiting payment.`,
        pushBodyAr: `طلبك #${orderNumber} بانتظار الدفع.`,
      },
    };

    const messages = statusMessages[newStatus];
    
    if (!messages) {
      console.error('[Notifications] No message template found for status:', newStatus);
      return;
    }
    
    const preferredLanguage = customerData?.preferredLanguage || 'ar';
    const whatsappMessage = preferredLanguage === 'ar' ? messages.whatsappAr : messages.whatsappEn;
    const pushTitle = preferredLanguage === 'ar' ? messages.pushTitleAr : messages.pushTitleEn;
    const pushBody = preferredLanguage === 'ar' ? messages.pushBodyAr : messages.pushBodyEn;

    if (customerPhone) {
      console.log('[WhatsApp] Sending message to:', customerPhone);
      console.log('[WhatsApp] Message:', whatsappMessage);
      await sendWhatsAppMessage(customerPhone, whatsappMessage);
      console.log('[WhatsApp] Notification sent successfully to customer:', customerId);
    }

    console.log('[Push] Sending push notification to:', customerId);
    await sendPushNotificationToUser(
      customerId,
      pushTitle,
      pushBody,
      {
        orderId: orderId,
        orderNumber: orderNumber,
        status: newStatus,
        type: 'order_status_update',
      }
    );
  } catch (error) {
    console.error('[Notifications] Error sending order status notification:', error);
  }
};

export const setupNotificationChannel = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('order-updates', {
      name: 'Order Updates',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6850E1',
      sound: 'default',
    });
    console.log('[Notifications] Android notification channel created');
  }
};
