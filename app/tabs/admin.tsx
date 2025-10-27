import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  I18nManager,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, doc, updateDoc, arrayUnion, getDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { sendOrderStatusNotification } from '@/services/notificationService';
import * as Notifications from 'expo-notifications';
import { logOrderStatusChange } from '@/services/activityLogService';
import { getDashboardKPIs, ensureTodayStats } from '@/services/dashboardService';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { Order, OrderStatus, StatusTimelineEntry } from '@/types';
import { Linking } from 'react-native';
import {
  Package as PackageIcon,
  ChevronRight,
  X,
  Clock,
  FileCheck,
  ChefHat,
  Truck,
  Building2,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Mail,
  Phone,
  Navigation,
  LayoutDashboard,
  TrendingUp,
  Users,
  ShoppingCart,
  ArrowUp,
  ArrowDown,
} from 'lucide-react-native';

const ORDER_WORKFLOW: {
  value: OrderStatus;
  label: string;
  labelAr: string;
  color: string;
  icon: any;
  next: OrderStatus[];
}[] = [
  {
    value: 'received',
    label: 'Received',
    labelAr: 'تم الاستلام',
    color: '#3B82F6',
    icon: PackageIcon,
    next: ['under_review', 'cancelled'],
  },
  {
    value: 'under_review',
    label: 'Under Review',
    labelAr: 'قيد المراجعة',
    color: '#F59E0B',
    icon: FileCheck,
    next: ['preparing', 'cancelled', 'awaiting_payment'],
  },
  {
    value: 'preparing',
    label: 'Preparing',
    labelAr: 'قيد التحضير',
    color: Colors.primary,
    icon: ChefHat,
    next: ['shipped', 'cancelled'],
  },
  {
    value: 'shipped',
    label: 'Shipped',
    labelAr: 'تم الشحن',
    color: '#8B5CF6',
    icon: Truck,
    next: ['arrived_hub', 'delivery_failed'],
  },
  {
    value: 'arrived_hub',
    label: 'Arrived Hub',
    labelAr: 'وصل المركز',
    color: '#06B6D4',
    icon: Building2,
    next: ['out_for_delivery', 'delivery_failed'],
  },
  {
    value: 'out_for_delivery',
    label: 'Out for Delivery',
    labelAr: 'في طريق التوصيل',
    color: '#10B981',
    icon: MapPin,
    next: ['delivered', 'delivery_failed'],
  },
  {
    value: 'delivered',
    label: 'Delivered',
    labelAr: 'تم التوصيل',
    color: Colors.success,
    icon: CheckCircle,
    next: [],
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    labelAr: 'ملغي',
    color: Colors.danger,
    icon: XCircle,
    next: [],
  },
  {
    value: 'delivery_failed',
    label: 'Delivery Failed',
    labelAr: 'فشل التوصيل',
    color: '#EF4444',
    icon: AlertCircle,
    next: ['out_for_delivery', 'cancelled'],
  },
  {
    value: 'awaiting_payment',
    label: 'Awaiting Payment',
    labelAr: 'بانتظار الدفع',
    color: '#F59E0B',
    icon: DollarSign,
    next: ['received', 'cancelled'],
  },
];

type ViewMode = 'dashboard' | 'orders';

export default function AdminScreen() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [statusNote, setStatusNote] = useState<string>('');
  const [hasNewOrders, setHasNewOrders] = useState<boolean>(false);
  const lastOrderCountRef = useRef<number>(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    console.log('[Admin] Setting up real-time order listener');
    
    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const currentCount = snapshot.size;
        console.log('[Admin] Orders snapshot update:', currentCount, 'orders');
        
        if (lastOrderCountRef.current > 0 && currentCount > lastOrderCountRef.current) {
          console.log('[Admin] New order detected!');
          setHasNewOrders(true);
          
          queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
          
          if (Platform.OS !== 'web') {
            Notifications.scheduleNotificationAsync({
              content: {
                title: '🔔 New Order Received!',
                body: 'A new order has been placed. Tap to view details.',
                sound: 'default',
                badge: currentCount - lastOrderCountRef.current,
              },
              trigger: null,
            }).catch(err => console.error('[Admin] Failed to show notification:', err));
          }
        }
        
        lastOrderCountRef.current = currentCount;
      },
      (error) => {
        console.error('[Admin] Error listening to orders:', error);
      }
    );

    return () => {
      console.log('[Admin] Cleaning up order listener');
      unsubscribe();
    };
  }, [queryClient]);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      await ensureTodayStats();
      return await getDashboardKPIs();
    },
    refetchInterval: 60000,
  });

  const ordersQuery = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'orders'));
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      newStatus,
      note,
    }: {
      orderId: string;
      newStatus: OrderStatus;
      note?: string;
    }) => {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (!orderDoc.exists()) {
        throw new Error('Order not found');
      }

      const orderData = orderDoc.data() as Order;
      const oldStatus = orderData.status;

      const timelineEntry: StatusTimelineEntry = {
        status: newStatus,
        timestamp: new Date(),
        note: note || undefined,
      };

      await updateDoc(orderRef, {
        status: newStatus,
        statusTimeline: arrayUnion(timelineEntry),
        updatedAt: new Date(),
      });

      await sendOrderStatusNotification(
        orderData.customerId,
        orderId,
        newStatus,
        orderId.slice(0, 8)
      );

      if (user) {
        await logOrderStatusChange(
          user.uid,
          user.displayName || 'Admin',
          user.email || 'admin@example.com',
          orderId,
          oldStatus,
          newStatus,
          orderData.customerName
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setStatusNote('');
      Alert.alert(
        'نجح - Success',
        'تم تحديث حالة الطلب بنجاح - Order status updated successfully'
      );
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const getStatusInfo = (status: OrderStatus) => {
    return ORDER_WORKFLOW.find((s) => s.value === status);
  };

  const canTransitionTo = (currentStatus: OrderStatus, targetStatus: OrderStatus): boolean => {
    const currentStatusInfo = getStatusInfo(currentStatus);
    return currentStatusInfo?.next.includes(targetStatus) || false;
  };

  const handleStatusUpdate = (orderId: string, newStatus: OrderStatus) => {
    Alert.alert(
      'تأكيد التحديث - Confirm Update',
      `هل تريد تغيير حالة الطلب إلى ${
        I18nManager.isRTL
          ? getStatusInfo(newStatus)?.labelAr
          : getStatusInfo(newStatus)?.label
      }؟`,
      [
        { text: 'إلغاء - Cancel', style: 'cancel' },
        {
          text: 'تأكيد - Confirm',
          onPress: () => {
            updateStatusMutation.mutate({ orderId, newStatus, note: statusNote });
          },
        },
      ]
    );
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const statusInfo = getStatusInfo(item.status);
    const StatusIcon = statusInfo?.icon || PackageIcon;

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => {
          setSelectedOrder(item);
          setModalVisible(true);
        }}
        testID={`order-${item.id}`}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderIdContainer}>
            <Text style={styles.orderId}>#{item.id.slice(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo?.color + '20' }]}>
              <StatusIcon size={14} color={statusInfo?.color} />
              <Text style={[styles.statusText, { color: statusInfo?.color }]}>
                {I18nManager.isRTL ? statusInfo?.labelAr : statusInfo?.label}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={Colors.textLight} />
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.customerEmail}>{item.customerEmail}</Text>
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>
            {item.currency} {item.totalAmount ? item.totalAmount.toFixed(2) : '0.00'}
          </Text>
          <Text style={styles.orderDate}>
            {item.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDashboard = () => {
    if (dashboardQuery.isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }

    if (dashboardQuery.error || !dashboardQuery.data) {
      return (
        <View style={styles.errorContainer}>
          <AlertCircle size={48} color={Colors.danger} />
          <Text style={styles.errorText}>خطأ في تحميل البيانات - Error loading data</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => dashboardQuery.refetch()}
          >
            <Text style={styles.retryButtonText}>إعادة المحاولة - Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const data = dashboardQuery.data;
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - 48;
    const chartHeight = 200;
    const maxRevenue = Math.max(...data.last14DaysData.map(d => d.revenue), 1);
    const maxOrders = Math.max(...data.last14DaysData.map(d => d.orders), 1);

    return (
      <ScrollView style={styles.dashboardContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: Colors.primary + '20' }]}>
              <ShoppingCart size={24} color={Colors.primary} />
            </View>
            <Text style={styles.kpiLabel}>اليوم - Today</Text>
            <Text style={styles.kpiValue}>{data.ordersToday}</Text>
            <Text style={styles.kpiSubtext}>طلبات - Orders</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: Colors.success + '20' }]}>
              <TrendingUp size={24} color={Colors.success} />
            </View>
            <Text style={styles.kpiLabel}>اليوم - Today</Text>
            <Text style={styles.kpiValue}>${data.revenueToday.toFixed(0)}</Text>
            <Text style={styles.kpiSubtext}>مبيعات - Revenue</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#3B82F6' + '20' }]}>
              <ShoppingCart size={24} color="#3B82F6" />
            </View>
            <Text style={styles.kpiLabel}>الأسبوع - Week</Text>
            <Text style={styles.kpiValue}>{data.ordersWeek}</Text>
            <Text style={styles.kpiSubtext}>طلبات - Orders</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#10B981' + '20' }]}>
              <TrendingUp size={24} color="#10B981" />
            </View>
            <Text style={styles.kpiLabel}>الأسبوع - Week</Text>
            <Text style={styles.kpiValue}>${data.revenueWeek.toFixed(0)}</Text>
            <Text style={styles.kpiSubtext}>مبيعات - Revenue</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#8B5CF6' + '20' }]}>
              <ShoppingCart size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.kpiLabel}>الشهر - Month</Text>
            <Text style={styles.kpiValue}>{data.ordersMonth}</Text>
            <Text style={styles.kpiSubtext}>طلبات - Orders</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#F59E0B' + '20' }]}>
              <TrendingUp size={24} color="#F59E0B" />
            </View>
            <Text style={styles.kpiLabel}>الشهر - Month</Text>
            <Text style={styles.kpiValue}>${data.revenueMonth.toFixed(0)}</Text>
            <Text style={styles.kpiSubtext}>مبيعات - Revenue</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#06B6D4' + '20' }]}>
              <Users size={24} color="#06B6D4" />
            </View>
            <Text style={styles.kpiLabel}>اليوم - Today</Text>
            <Text style={styles.kpiValue}>{data.newCustomersToday}</Text>
            <Text style={styles.kpiSubtext}>عملاء جدد - New</Text>
          </View>

          <View style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: '#06B6D4' + '20' }]}>
              <Users size={24} color="#06B6D4" />
            </View>
            <Text style={styles.kpiLabel}>الأسبوع - Week</Text>
            <Text style={styles.kpiValue}>{data.newCustomersWeek}</Text>
            <Text style={styles.kpiSubtext}>عملاء جدد - New</Text>
          </View>
        </View>

        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>آخر 14 يوم - Last 14 Days</Text>
          <View style={styles.chartContainer}>
            <View style={[styles.chart, { width: chartWidth, height: chartHeight }]}>
              {data.last14DaysData.map((item, index) => {
                const barHeight = (item.revenue / maxRevenue) * (chartHeight - 40);
                const barWidth = (chartWidth - 60) / data.last14DaysData.length - 4;
                
                return (
                  <View
                    key={item.date}
                    style={[
                      styles.chartBar,
                      {
                        height: barHeight > 0 ? barHeight : 2,
                        width: barWidth,
                        left: 40 + (index * ((chartWidth - 60) / data.last14DaysData.length)),
                      },
                    ]}
                  >
                    {item.revenue > 0 && (
                      <View style={styles.chartTooltip}>
                        <Text style={styles.chartTooltipText}>
                          {item.orders}📦
                        </Text>
                        <Text style={styles.chartTooltipText}>
                          ${item.revenue.toFixed(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              
              <View style={styles.chartAxisY}>
                <Text style={styles.chartAxisLabel}>${maxRevenue.toFixed(0)}</Text>
                <View style={{ flex: 1 }}></View>
                <Text style={styles.chartAxisLabel}>$0</Text>
              </View>
              
              <View style={styles.chartAxisX}>
                <Text style={styles.chartAxisLabel}>
                  {data.last14DaysData[0]?.date.split('-')[2] || ''}
                </Text>
                <View style={{ flex: 1 }}></View>
                <Text style={styles.chartAxisLabel}>
                  {data.last14DaysData[data.last14DaysData.length - 1]?.date.split('-')[2] || ''}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>
            {I18nManager.isRTL ? 'لوحة الإدارة' : 'Admin Panel'}
          </Text>
          {hasNewOrders && (
            <View style={styles.newOrderBadge}>
              <View style={styles.newOrderDot} />
              <Text style={styles.newOrderText}>New Order!</Text>
            </View>
          )}
        </View>
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              viewMode === 'dashboard' && styles.tabActive,
            ]}
            onPress={() => setViewMode('dashboard')}
          >
            <LayoutDashboard
              size={18}
              color={viewMode === 'dashboard' ? Colors.white : Colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                viewMode === 'dashboard' && styles.tabTextActive,
              ]}
            >
              {I18nManager.isRTL ? 'لوحة القيادة' : 'Dashboard'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              viewMode === 'orders' && styles.tabActive,
            ]}
            onPress={() => {
              setViewMode('orders');
              setHasNewOrders(false);
            }}
          >
            <PackageIcon
              size={18}
              color={viewMode === 'orders' ? Colors.white : Colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                viewMode === 'orders' && styles.tabTextActive,
              ]}
            >
              {I18nManager.isRTL ? 'الطلبات' : 'Orders'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'dashboard' ? renderDashboard() : null}

      {viewMode === 'orders' ? (

        ordersQuery.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={ordersQuery.data}
            renderItem={renderOrderCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <PackageIcon size={64} color={Colors.textLight} />
                <Text style={styles.emptyText}>لا توجد طلبات - No orders found</Text>
              </View>
            }
          />
        )
      ) : null}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل الطلب - Order Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} testID="close-modal">
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>معلومات العميل - Customer Info</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>رقم الطلب - Order ID:</Text>
                    <Text style={styles.infoValue}>#{selectedOrder.id.slice(0, 12)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>الاسم - Name:</Text>
                    <Text style={styles.infoValue}>{selectedOrder.customerName}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>البريد - Email:</Text>
                    <View style={styles.contactValueContainer}>
                      <Mail size={14} color={Colors.primary} />
                      <Text style={styles.infoValue}>{selectedOrder.customerEmail}</Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>الهاتف - Phone:</Text>
                    <TouchableOpacity 
                      style={styles.contactValueContainer}
                      onPress={() => Linking.openURL(`tel:${selectedOrder.customerPhone}`)}
                    >
                      <Phone size={14} color={Colors.primary} />
                      <Text style={[styles.infoValue, styles.linkText]}>{selectedOrder.customerPhone}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>الإجمالي - Total:</Text>
                    <Text style={styles.infoValue}>
                      {selectedOrder.currency}{' '}
                      {selectedOrder.totalAmount ? selectedOrder.totalAmount.toFixed(2) : '0.00'}
                    </Text>
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>عنوان التوصيل - Delivery Address</Text>
                    <TouchableOpacity
                      style={styles.whatsappButton}
                      onPress={() => {
                        const address = `${selectedOrder.shippingAddress.street}, ${selectedOrder.shippingAddress.city}, ${selectedOrder.shippingAddress.state}, ${selectedOrder.shippingAddress.country}`;
                        const message = `توصيل الطلب #${selectedOrder.id.slice(0, 8)}\nDelivery for Order #${selectedOrder.id.slice(0, 8)}\n\nالعميل - Customer: ${selectedOrder.customerName}\nالهاتف - Phone: ${selectedOrder.customerPhone}\n\nالعنوان - Address:\n${address}\n\nالإجمالي - Total: ${selectedOrder.currency} ${selectedOrder.totalAmount ? selectedOrder.totalAmount.toFixed(2) : '0.00'}`;
                        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
                        Linking.openURL(whatsappUrl).catch(() => {
                          Alert.alert(
                            'خطأ - Error',
                            'الرجاء التأكد من تثبيت واتساب\nPlease make sure WhatsApp is installed'
                          );
                        });
                      }}
                      testID="share-whatsapp"
                    >
                      <Navigation size={20} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.addressText}>
                    {selectedOrder.shippingAddress.street}
                    {'\n'}
                    {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}
                    {'\n'}
                    {selectedOrder.shippingAddress.country} - {selectedOrder.shippingAddress.postalCode}
                  </Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>المنتجات - Products</Text>
                  {selectedOrder.items.map((item, index) => (
                    <View key={index} style={styles.productItem}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>
                          {I18nManager.isRTL ? item.productNameAr : item.productName}
                        </Text>
                        <Text style={styles.productQuantity}>
                          الكمية - Qty: {item.quantity}
                        </Text>
                      </View>
                      <Text style={styles.productPrice}>
                        {selectedOrder.currency} {(item.price * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    السجل الزمني للحالة - Status Timeline
                  </Text>
                  {selectedOrder.statusTimeline &&
                  selectedOrder.statusTimeline.length > 0 ? (
                    selectedOrder.statusTimeline.map((entry, index) => {
                      const statusInfo = getStatusInfo(entry.status);
                      const StatusIcon = statusInfo?.icon || Clock;
                      return (
                        <View key={index} style={styles.timelineItem}>
                          <View
                            style={[
                              styles.timelineIcon,
                              { backgroundColor: statusInfo?.color + '20' },
                            ]}
                          >
                            <StatusIcon size={16} color={statusInfo?.color} />
                          </View>
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineStatus}>
                              {I18nManager.isRTL ? statusInfo?.labelAr : statusInfo?.label}
                            </Text>
                            <Text style={styles.timelineDate}>
                              {entry.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                            </Text>
                            {entry.note && (
                              <Text style={styles.timelineNote}>{entry.note}</Text>
                            )}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noTimelineText}>
                      لا يوجد سجل - No timeline available
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    تحديث الحالة - Push Status Update
                  </Text>
                  <Text style={styles.currentStatusLabel}>
                    الحالة الحالية - Current Status:
                  </Text>
                  <View style={styles.currentStatusContainer}>
                    {(() => {
                      const statusInfo = getStatusInfo(selectedOrder.status);
                      const StatusIcon = statusInfo?.icon || Clock;
                      return (
                        <>
                          <StatusIcon size={18} color={statusInfo?.color} />
                          <Text
                            style={[
                              styles.currentStatusText,
                              { color: statusInfo?.color },
                            ]}
                          >
                            {I18nManager.isRTL ? statusInfo?.labelAr : statusInfo?.label}
                          </Text>
                        </>
                      );
                    })()}
                  </View>

                  <Text style={styles.nextStatusLabel}>
                    الحالات التالية المتاحة - Available Next Statuses:
                  </Text>

                  <TextInput
                    style={styles.noteInput}
                    placeholder={
                      I18nManager.isRTL
                        ? 'ملاحظة (اختياري)'
                        : 'Note (optional)'
                    }
                    placeholderTextColor={Colors.textLight}
                    value={statusNote}
                    onChangeText={setStatusNote}
                    multiline
                    numberOfLines={3}
                    textAlign={I18nManager.isRTL ? 'right' : 'left'}
                  />

                  <View style={styles.statusButtons}>
                    {ORDER_WORKFLOW.map((status) => {
                      const canTransition = canTransitionTo(
                        selectedOrder.status,
                        status.value
                      );
                      const StatusIcon = status.icon;
                      const isCurrent = selectedOrder.status === status.value;

                      if (!canTransition && !isCurrent) return null;

                      return (
                        <TouchableOpacity
                          key={status.value}
                          style={[
                            styles.statusButton,
                            { borderColor: status.color },
                            isCurrent && styles.statusButtonDisabled,
                          ]}
                          onPress={() =>
                            handleStatusUpdate(selectedOrder.id, status.value)
                          }
                          disabled={
                            !canTransition ||
                            isCurrent ||
                            updateStatusMutation.isPending
                          }
                          testID={`status-${status.value}`}
                        >
                          <StatusIcon
                            size={18}
                            color={isCurrent ? Colors.textLight : status.color}
                          />
                          <Text
                            style={[
                              styles.statusButtonText,
                              {
                                color: isCurrent ? Colors.textLight : status.color,
                              },
                            ]}
                          >
                            {I18nManager.isRTL ? status.labelAr : status.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {selectedOrder.notes && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ملاحظات - Notes</Text>
                    <Text style={styles.notesText}>{selectedOrder.notes}</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  newOrderBadge: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  newOrderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  newOrderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  tabsContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 8,
  },
  tab: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.background,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  dashboardContainer: {
    flex: 1,
    padding: 16,
  },
  kpiGrid: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  kpiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiLabel: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 4,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  kpiSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  chartSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  chartContainer: {
    alignItems: 'center',
  },
  chart: {
    position: 'relative' as const,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
  },
  chartBar: {
    position: 'absolute' as const,
    bottom: 30,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartTooltip: {
    position: 'absolute' as const,
    top: -40,
    alignSelf: 'center',
    backgroundColor: Colors.text,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    minWidth: 50,
  },
  chartTooltipText: {
    fontSize: 10,
    color: Colors.white,
    textAlign: 'center',
  },
  chartAxisY: {
    position: 'absolute' as const,
    left: 0,
    top: 16,
    bottom: 30,
    width: 35,
    justifyContent: 'space-between',
  },
  chartAxisX: {
    position: 'absolute' as const,
    bottom: 0,
    left: 40,
    right: 16,
    height: 25,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartAxisLabel: {
    fontSize: 10,
    color: Colors.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statusBadge: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  orderInfo: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  customerEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  orderFooter: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  orderDate: {
    fontSize: 13,
    color: Colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalBody: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  infoRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: I18nManager.isRTL ? 'left' : 'right',
  },
  contactValueContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    color: Colors.primary,
    textDecorationLine: 'underline' as const,
  },
  sectionHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  whatsappButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  addressText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
  },
  productItem: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  productQuantity: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  timelineItem: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    marginBottom: 16,
    gap: 12,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  timelineDate: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  timelineNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  noTimelineText: {
    fontSize: 14,
    color: Colors.textLight,
    textAlign: 'center',
    fontStyle: 'italic' as const,
  },
  currentStatusLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  currentStatusContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    marginBottom: 16,
  },
  currentStatusText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  nextStatusLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  noteInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    minHeight: 80,
  },
  statusButtons: {
    gap: 8,
  },
  statusButton: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
  },
  statusButtonDisabled: {
    opacity: 0.4,
  },
  statusButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
});
