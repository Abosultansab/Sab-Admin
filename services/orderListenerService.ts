import * as Notifications from 'expo-notifications';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Order } from '@/types';
import { Platform } from 'react-native';

let lastOrderCount = 0;
let isInitialized = false;
let unsubscribe: (() => void) | null = null;

export const startOrderListener = async (): Promise<void> => {
  try {
    console.log('[OrderListener] Starting order listener...');

    if (unsubscribe) {
      console.log('[OrderListener] Listener already active');
      return;
    }

    const ordersQuery = query(collection(db, 'orders'));

    unsubscribe = onSnapshot(
      ordersQuery,
      async (snapshot) => {
        console.log('[OrderListener] Orders snapshot received:', snapshot.docs.length);

        if (!isInitialized) {
          lastOrderCount = snapshot.docs.length;
          isInitialized = true;
          console.log('[OrderListener] Initialized with', lastOrderCount, 'orders');
          return;
        }

        const currentOrderCount = snapshot.docs.length;

        if (currentOrderCount > lastOrderCount) {
          const newOrdersCount = currentOrderCount - lastOrderCount;
          console.log('[OrderListener] New order(s) detected:', newOrdersCount);

          const changes = snapshot.docChanges();
          
          for (const change of changes) {
            if (change.type === 'added') {
              const orderData = change.doc.data();
              const order: Order = {
                ...orderData,
                id: change.doc.id,
              } as Order;

              const isRecentOrder = isOrderRecent(order.createdAt);
              
              if (isRecentOrder) {
                console.log('[OrderListener] Sending notification for new order:', order.id);
                await sendLocalNotification(order);
              }
            }
          }
        }

        lastOrderCount = currentOrderCount;
      },
      (error) => {
        console.error('[OrderListener] Error in order listener:', error);
      }
    );

    console.log('[OrderListener] Order listener started successfully');
  } catch (error) {
    console.error('[OrderListener] Error starting order listener:', error);
  }
};

export const stopOrderListener = (): void => {
  console.log('[OrderListener] Stopping order listener...');
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    isInitialized = false;
    lastOrderCount = 0;
    console.log('[OrderListener] Order listener stopped');
  }
};

const isOrderRecent = (createdAt: Timestamp | Date): boolean => {
  try {
    const orderTime = createdAt instanceof Timestamp 
      ? createdAt.toDate() 
      : createdAt;
    
    const now = new Date();
    const diffMs = now.getTime() - orderTime.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    return diffMinutes < 2;
  } catch (error) {
    console.error('[OrderListener] Error checking order time:', error);
    return false;
  }
};

const sendLocalNotification = async (order: Order): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      console.log('[OrderListener] Notifications not fully supported on web');
      return;
    }

    const orderId = order.id.slice(0, 8);
    const totalAmount = order.totalAmount ? order.totalAmount.toFixed(2) : '0.00';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🛒 طلب جديد - New Order!',
        body: `Order #${orderId} من ${order.customerName}\nTotal: ${order.currency} ${totalAmount}`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: {
          orderId: order.id,
          customerId: order.customerId,
          type: 'new_order',
        },
        badge: 1,
      },
      trigger: null,
    });

    console.log('[OrderListener] Local notification sent for order:', order.id);

    if (Platform.OS === 'android') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🛒 طلب جديد - New Order!',
          body: `Order #${orderId} من ${order.customerName}\nTotal: ${order.currency} ${totalAmount}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: {
            orderId: order.id,
            customerId: order.customerId,
            type: 'new_order',
          },
          badge: 1,
        },
        trigger: { seconds: 1, channelId: 'order-updates' },
      });
    }
  } catch (error) {
    console.error('[OrderListener] Error sending notification:', error);
  }
};
