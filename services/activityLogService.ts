import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ActivityLogType } from '@/types';

interface LogActivityParams {
  type: ActivityLogType;
  action: string;
  actionAr: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLogs'), {
      type: params.type,
      action: params.action,
      actionAr: params.actionAr,
      actorId: params.actorId,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      targetId: params.targetId,
      targetName: params.targetName,
      metadata: params.metadata,
      timestamp: serverTimestamp(),
    });

    console.log('Activity logged:', params.type);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

export async function logOrderStatusChange(
  actorId: string,
  actorName: string,
  actorEmail: string,
  orderId: string,
  oldStatus: string,
  newStatus: string,
  customerName?: string
): Promise<void> {
  await logActivity({
    type: 'order_status_change',
    action: `Changed order #${orderId.slice(0, 8)} status from ${oldStatus} to ${newStatus}`,
    actionAr: `تم تغيير حالة الطلب #${orderId.slice(0, 8)} من ${oldStatus} إلى ${newStatus}`,
    actorId,
    actorName,
    actorEmail,
    targetId: orderId,
    targetName: customerName,
    metadata: {
      orderId,
      oldStatus,
      newStatus,
    },
  });
}

export async function logNotificationSent(
  actorId: string,
  actorName: string,
  actorEmail: string,
  notificationTitle: string,
  targetType: 'all' | 'specific' | 'admins',
  targetUserIds?: string[]
): Promise<void> {
  await logActivity({
    type: 'notification_sent',
    action: `Sent notification "${notificationTitle}" to ${targetType}`,
    actionAr: `تم إرسال إشعار "${notificationTitle}" إلى ${targetType}`,
    actorId,
    actorName,
    actorEmail,
    metadata: {
      notificationTitle,
      targetType,
      targetUserIds,
    },
  });
}

export async function logCustomerBan(
  actorId: string,
  actorName: string,
  actorEmail: string,
  customerId: string,
  customerName: string,
  reason?: string
): Promise<void> {
  await logActivity({
    type: 'customer_ban',
    action: `Banned customer ${customerName}`,
    actionAr: `تم حظر العميل ${customerName}`,
    actorId,
    actorName,
    actorEmail,
    targetId: customerId,
    targetName: customerName,
    metadata: {
      reason,
    },
  });
}

export async function logCustomerUnban(
  actorId: string,
  actorName: string,
  actorEmail: string,
  customerId: string,
  customerName: string
): Promise<void> {
  await logActivity({
    type: 'customer_unban',
    action: `Unbanned customer ${customerName}`,
    actionAr: `تم إلغاء حظر العميل ${customerName}`,
    actorId,
    actorName,
    actorEmail,
    targetId: customerId,
    targetName: customerName,
  });
}

export async function logInvoiceGenerated(
  actorId: string,
  actorName: string,
  actorEmail: string,
  orderId: string,
  invoiceNumber: string,
  amount: number,
  customerName?: string
): Promise<void> {
  await logActivity({
    type: 'invoice_generated',
    action: `Generated invoice ${invoiceNumber} for order #${orderId.slice(0, 8)}`,
    actionAr: `تم إنشاء فاتورة ${invoiceNumber} للطلب #${orderId.slice(0, 8)}`,
    actorId,
    actorName,
    actorEmail,
    targetId: orderId,
    targetName: customerName,
    metadata: {
      invoiceNumber,
      amount,
    },
  });
}

export async function logPromotionCreated(
  actorId: string,
  actorName: string,
  actorEmail: string,
  promotionName: string,
  promotionId: string,
  discount: number
): Promise<void> {
  await logActivity({
    type: 'promotion_created',
    action: `Created promotion "${promotionName}" with ${discount}% discount`,
    actionAr: `تم إنشاء عرض ترويجي "${promotionName}" بخصم ${discount}%`,
    actorId,
    actorName,
    actorEmail,
    targetId: promotionId,
    targetName: promotionName,
    metadata: {
      discount,
    },
  });
}

export async function logProductCreated(
  actorId: string,
  actorName: string,
  actorEmail: string,
  productId: string,
  productName: string
): Promise<void> {
  await logActivity({
    type: 'product_created',
    action: `Created product "${productName}"`,
    actionAr: `تم إنشاء منتج "${productName}"`,
    actorId,
    actorName,
    actorEmail,
    targetId: productId,
    targetName: productName,
  });
}

export async function logProductUpdated(
  actorId: string,
  actorName: string,
  actorEmail: string,
  productId: string,
  productName: string,
  changes: string[]
): Promise<void> {
  await logActivity({
    type: 'product_updated',
    action: `Updated product "${productName}"`,
    actionAr: `تم تحديث منتج "${productName}"`,
    actorId,
    actorName,
    actorEmail,
    targetId: productId,
    targetName: productName,
    metadata: {
      changes,
    },
  });
}

export async function logProductDeleted(
  actorId: string,
  actorName: string,
  actorEmail: string,
  productId: string,
  productName: string
): Promise<void> {
  await logActivity({
    type: 'product_deleted',
    action: `Deleted product "${productName}"`,
    actionAr: `تم حذف منتج "${productName}"`,
    actorId,
    actorName,
    actorEmail,
    targetId: productId,
    targetName: productName,
  });
}
