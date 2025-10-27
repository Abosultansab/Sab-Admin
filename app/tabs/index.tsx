import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  I18nManager,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Folder,
  Tag,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: readonly [string, string, ...string[]];
  trend?: string;
}

function StatCard({ title, value, icon, gradient, trend, onPress }: StatCardProps & { onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <LinearGradient colors={gradient} style={styles.statCard}>
        <View style={styles.statCardContent}>
          <View style={styles.statCardHeader}>
            <View style={styles.iconContainer}>
              {icon}
            </View>
            <Text style={styles.statValue}>{value}</Text>
          </View>
          <Text style={styles.statTitle}>{title}</Text>
          {trend && (
            <View style={styles.trendContainer}>
              <TrendingUp size={14} color={Colors.white} />
              <Text style={styles.trendText}>{trend}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);

  const productsQuery = useQuery({
    queryKey: ['products-count'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'products'));
      return snapshot.size;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ['orders-stats'],
    queryFn: async () => {
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const pendingSnapshot = await getDocs(
        query(collection(db, 'orders'), where('status', '==', 'pending'))
      );
      return {
        total: ordersSnapshot.size,
        pending: pendingSnapshot.size,
      };
    },
  });

  const customersQuery = useQuery({
    queryKey: ['customers-count'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.size;
    },
  });

  const brandsQuery = useQuery({
    queryKey: ['brands-count'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'brands'));
      return snapshot.size;
    },
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      productsQuery.refetch(),
      ordersQuery.refetch(),
      customersQuery.refetch(),
      brandsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const stats: StatCardProps[] = [
    {
      title: 'المنتجات - Products',
      value: productsQuery.data || 0,
      icon: <Package size={24} color={Colors.white} />,
      gradient: [Colors.primary, Colors.primaryDark] as const,
      trend: '+12%',
    },
    {
      title: 'الطلبات - Orders',
      value: ordersQuery.data?.total || 0,
      icon: <ShoppingCart size={24} color={Colors.white} />,
      gradient: [Colors.success, Colors.successDark] as const,
      trend: '+8%',
    },
    {
      title: 'العملاء - Customers',
      value: customersQuery.data || 0,
      icon: <Users size={24} color={Colors.white} />,
      gradient: [Colors.secondary, Colors.secondaryDark] as const,
      trend: '+15%',
    },
    {
      title: 'العلامات - Brands',
      value: brandsQuery.data || 0,
      icon: <DollarSign size={24} color={Colors.white} />,
      gradient: [Colors.warning, Colors.warningDark] as const,
    },
  ];

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>مرحباً - Welcome</Text>
        <Text style={styles.title}>لوحة التحكم - Dashboard</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCardWrapper}>
          <StatCard {...stats[0]} onPress={() => router.push('/(tabs)/products')} />
        </View>
        <View style={styles.statCardWrapper}>
          <StatCard {...stats[1]} onPress={() => router.push('/(tabs)/orders')} />
        </View>
        <View style={styles.statCardWrapper}>
          <StatCard {...stats[2]} onPress={() => router.push('/(tabs)/customers')} />
        </View>
        <View style={styles.statCardWrapper}>
          <StatCard {...stats[3]} onPress={() => router.push('/(tabs)/brands')} />
        </View>
      </View>

      {ordersQuery.data && ordersQuery.data.pending > 0 && (
        <TouchableOpacity 
          style={styles.alertCard}
          onPress={() => router.push('/(tabs)/orders')}
        >
          <View style={styles.alertIcon}>
            <AlertCircle size={24} color={Colors.warning} />
          </View>
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>طلبات قيد الانتظار - Pending Orders</Text>
            <Text style={styles.alertText}>
              لديك {ordersQuery.data.pending} طلب قيد الانتظار - You have{' '}
              {ordersQuery.data.pending} pending orders
            </Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>إجراءات سريعة - Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/products')}
          >
            <Package size={32} color={Colors.primary} />
            <Text style={styles.actionText}>إدارة المنتجات{'\n'}Manage Products</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/orders')}
          >
            <ShoppingCart size={32} color={Colors.success} />
            <Text style={styles.actionText}>عرض الطلبات{'\n'}View Orders</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/categories')}
          >
            <Folder size={32} color={Colors.secondary} />
            <Text style={styles.actionText}>إدارة الفئات{'\n'}Manage Categories</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/brands')}
          >
            <Tag size={32} color={Colors.warning} />
            <Text style={styles.actionText}>إدارة العلامات{'\n'}Manage Brands</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 16,
  },
  statCardWrapper: {
    width: '50%',
    padding: 8,
  },
  statCard: {
    borderRadius: 16,
    padding: 16,
    minHeight: 140,
  },
  statCardContent: {
    flex: 1,
  },
  statCardHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  statTitle: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  trendContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '600' as const,
  },
  alertCard: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: I18nManager.isRTL ? 0 : 4,
    borderRightWidth: I18nManager.isRTL ? 4 : 0,
    borderColor: Colors.warning,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertIcon: {
    marginRight: I18nManager.isRTL ? 0 : 12,
    marginLeft: I18nManager.isRTL ? 12 : 0,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  alertText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  quickActions: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
});
