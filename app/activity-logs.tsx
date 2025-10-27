import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  I18nManager,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Colors from '@/constants/colors';
import { ActivityLog, ActivityLogType } from '@/types';
import {
  FileText,
  Bell,
  UserX,
  UserCheck,
  Gift,
  FileCheck,
  UserPlus,
  Trash2,
  Package,
  Edit,
  Filter,
  ChevronLeft,
  AlertCircle,
} from '@/components/lucide-shim';
import { Stack, useRouter } from 'expo-router';

const LOG_TYPE_CONFIG: {
  [key in ActivityLogType]: {
    label: string;
    labelAr: string;
    icon: any;
    color: string;
  };
} = {
  order_status_change: {
    label: 'Order Status Change',
    labelAr: 'تغيير حالة الطلب',
    icon: FileText,
    color: Colors.primary,
  },
  notification_sent: {
    label: 'Notification Sent',
    labelAr: 'إرسال إشعار',
    icon: Bell,
    color: '#3B82F6',
  },
  customer_ban: {
    label: 'Customer Ban',
    labelAr: 'حظر عميل',
    icon: UserX,
    color: Colors.danger,
  },
  customer_unban: {
    label: 'Customer Unban',
    labelAr: 'إلغاء حظر عميل',
    icon: UserCheck,
    color: Colors.success,
  },
  promotion_created: {
    label: 'Promotion Created',
    labelAr: 'إنشاء عرض ترويجي',
    icon: Gift,
    color: '#F59E0B',
  },
  invoice_generated: {
    label: 'Invoice Generated',
    labelAr: 'إنشاء فاتورة',
    icon: FileCheck,
    color: '#10B981',
  },
  user_created: {
    label: 'User Created',
    labelAr: 'إنشاء مستخدم',
    icon: UserPlus,
    color: '#8B5CF6',
  },
  user_deleted: {
    label: 'User Deleted',
    labelAr: 'حذف مستخدم',
    icon: Trash2,
    color: '#EF4444',
  },
  product_created: {
    label: 'Product Created',
    labelAr: 'إنشاء منتج',
    icon: Package,
    color: '#06B6D4',
  },
  product_updated: {
    label: 'Product Updated',
    labelAr: 'تحديث منتج',
    icon: Edit,
    color: '#F59E0B',
  },
  product_deleted: {
    label: 'Product Deleted',
    labelAr: 'حذف منتج',
    icon: Trash2,
    color: '#EF4444',
  },
};

const FILTER_OPTIONS: { value: ActivityLogType | 'all'; label: string; labelAr: string }[] = [
  { value: 'all', label: 'All Activities', labelAr: 'جميع الأنشطة' },
  { value: 'order_status_change', label: 'Order Changes', labelAr: 'تغييرات الطلبات' },
  { value: 'notification_sent', label: 'Notifications', labelAr: 'الإشعارات' },
  { value: 'customer_ban', label: 'Customer Bans', labelAr: 'حظر العملاء' },
  { value: 'customer_unban', label: 'Customer Unbans', labelAr: 'إلغاء الحظر' },
  { value: 'promotion_created', label: 'Promotions', labelAr: 'العروض الترويجية' },
  { value: 'invoice_generated', label: 'Invoices', labelAr: 'الفواتير' },
];

export default function ActivityLogsScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<ActivityLogType | 'all'>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const logsQuery = useQuery({
    queryKey: ['activity-logs', selectedFilter],
    queryFn: async () => {
      let q = query(
        collection(db, 'activityLogs'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );

      if (selectedFilter !== 'all') {
        q = query(
          collection(db, 'activityLogs'),
          where('type', '==', selectedFilter),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ActivityLog[];
    },
  });

  const groupedLogs = useMemo(() => {
    if (!logsQuery.data) return {};

    const groups: { [key: string]: ActivityLog[] } = {};

    logsQuery.data.forEach((log) => {
      const date = log.timestamp?.toDate?.()?.toLocaleDateString() || 'Unknown';
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(log);
    });

    return groups;
  }, [logsQuery.data]);

  const renderLogItem = ({ item }: { item: ActivityLog }) => {
    const config = LOG_TYPE_CONFIG[item.type];
    const LogIcon = config?.icon || AlertCircle;

    return (
      <View style={styles.logCard} testID={`log-${item.id}`}>
        <View style={[styles.logIconContainer, { backgroundColor: config?.color + '20' }]}>
          <LogIcon size={20} color={config?.color} />
        </View>

        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={styles.logType}>
              {I18nManager.isRTL ? config?.labelAr : config?.label}
            </Text>
            <Text style={styles.logTime}>
              {item.timestamp?.toDate?.()?.toLocaleTimeString() || 'N/A'}
            </Text>
          </View>

          <Text style={styles.logAction}>
            {I18nManager.isRTL ? item.actionAr : item.action}
          </Text>

          <View style={styles.logFooter}>
            <Text style={styles.logActor}>
              {I18nManager.isRTL ? 'بواسطة:' : 'By:'} {item.actorName}
            </Text>
            {item.targetName && (
              <Text style={styles.logTarget}>
                {I18nManager.isRTL ? 'الهدف:' : 'Target:'} {item.targetName}
              </Text>
            )}
          </View>

          {item.metadata && Object.keys(item.metadata).length > 0 && (
            <View style={styles.metadataContainer}>
              {Object.entries(item.metadata).map(([key, value]) => (
                <Text key={key} style={styles.metadataText}>
                  {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderDateSection = ({ item }: { item: [string, ActivityLog[]] }) => {
    const [date, logs] = item;

    return (
      <View style={styles.dateSection}>
        <Text style={styles.dateHeader}>{date}</Text>
        {logs.map((log) => (
          <View key={log.id}>{renderLogItem({ item: log })}</View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: I18nManager.isRTL ? 'سجل الأنشطة' : 'Activity Logs',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              testID="back-button"
            >
              <ChevronLeft
                size={24}
                color={Colors.text}
                style={I18nManager.isRTL ? { transform: [{ rotate: '180deg' }] } : {}}
              />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowFilters(!showFilters)}
              style={styles.filterButton}
              testID="filter-button"
            >
              <Filter size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {showFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterChip,
                selectedFilter === option.value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(option.value)}
              testID={`filter-${option.value}`}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === option.value && styles.filterChipTextActive,
                ]}
              >
                {I18nManager.isRTL ? option.labelAr : option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {logsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : logsQuery.error ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={64} color={Colors.danger} />
          <Text style={styles.errorText}>
            {I18nManager.isRTL
              ? 'خطأ في تحميل السجلات'
              : 'Error loading activity logs'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={Object.entries(groupedLogs)}
          renderItem={renderDateSection}
          keyExtractor={(item) => item[0]}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FileText size={64} color={Colors.textLight} />
              <Text style={styles.emptyText}>
                {I18nManager.isRTL ? 'لا توجد سجلات' : 'No activity logs found'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 8,
    marginLeft: Platform.OS === 'ios' ? 0 : 8,
  },
  filterButton: {
    padding: 8,
    marginRight: Platform.OS === 'ios' ? 0 : 8,
  },
  filterContainer: {
    maxHeight: 60,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterContent: {
    padding: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: 16,
  },
  listContent: {
    padding: 16,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  logCard: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 12,
  },
  logIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logType: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  logTime: {
    fontSize: 12,
    color: Colors.textLight,
  },
  logAction: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  logFooter: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 16,
  },
  logActor: {
    fontSize: 12,
    color: Colors.textLight,
  },
  logTarget: {
    fontSize: 12,
    color: Colors.textLight,
  },
  metadataContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metadataText: {
    fontSize: 11,
    color: Colors.textLight,
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
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
});
