import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  I18nManager,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { Users, Search, UserCheck, UserX, Shield, X, Mail, Phone, RefreshCw } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Colors from '@/constants/colors';
import { Customer } from '@/types';

export default function CustomersScreen() {
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      console.log('[CustomersScreen] Fetching users...');
      const snapshot = await getDocs(collection(db, 'users'));
      console.log('[CustomersScreen] Found users:', snapshot.docs.length);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        console.log('[CustomersScreen] User data:', { id: doc.id, ...data });
        return {
          id: doc.id,
          email: data.email || '',
          displayName: data.displayName || data.name || data.fullName || 'Unknown',
          phone: data.phone || undefined,
          photoURL: data.photoURL || undefined,
          isBlocked: data.isBlocked || false,
          isAdmin: data.isAdmin || false,
          totalOrders: data.totalOrders || 0,
          totalSpent: data.totalSpent || 0,
          fcmToken: data.fcmToken || undefined,
          createdAt: data.createdAt,
          lastLoginAt: data.lastLoginAt,
        } as Customer;
      });
    },
  });

  useEffect(() => {
    console.log('[CustomersScreen] Mounted, customers count:', customersQuery.data?.length);
  }, [customersQuery.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['customers'] });
    await customersQuery.refetch();
    setRefreshing(false);
  };

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Customer> }) => {
      console.log('[CustomersScreen] Updating user:', id, data);
      await updateDoc(doc(db, 'users', id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setModalVisible(false);
      Alert.alert('نجح - Success', 'تم تحديث العميل بنجاح - Customer updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const handleBlockCustomer = (customer: Customer) => {
    Alert.alert(
      customer.isBlocked ? 'إلغاء الحظر - Unblock' : 'حظر - Block',
      customer.isBlocked
        ? 'هل تريد إلغاء حظر هذا العميل؟ - Unblock this customer?'
        : 'هل تريد حظر هذا العميل؟ - Block this customer?',
      [
        { text: 'إلغاء - Cancel', style: 'cancel' },
        {
          text: customer.isBlocked ? 'إلغاء الحظر - Unblock' : 'حظر - Block',
          style: customer.isBlocked ? 'default' : 'destructive',
          onPress: () =>
            updateCustomerMutation.mutate({
              id: customer.id,
              data: { isBlocked: !customer.isBlocked },
            }),
        },
      ]
    );
  };

  const handleToggleAdmin = (customer: Customer) => {
    Alert.alert(
      customer.isAdmin ? 'إزالة صلاحيات الأدمن - Remove Admin' : 'ترقية لأدمن - Promote to Admin',
      customer.isAdmin
        ? 'هل تريد إزالة صلاحيات الأدمن من هذا العميل؟ - Remove admin privileges?'
        : 'هل تريد ترقية هذا العميل لأدمن؟ - Promote this customer to admin?',
      [
        { text: 'إلغاء - Cancel', style: 'cancel' },
        {
          text: customer.isAdmin ? 'إزالة - Remove' : 'ترقية - Promote',
          onPress: () =>
            updateCustomerMutation.mutate({
              id: customer.id,
              data: { isAdmin: !customer.isAdmin },
            }),
        },
      ]
    );
  };

  const filteredCustomers = React.useMemo(
    () =>
      customersQuery.data?.filter(
        (customer) =>
          customer.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [customersQuery.data, searchQuery]
  );

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={[styles.customerCard, item.isBlocked && styles.customerCardBlocked]}
      onPress={() => {
        setSelectedCustomer(item);
        setModalVisible(true);
      }}
      testID={`customer-${item.id}`}
    >
      <View style={styles.customerAvatar}>
        <Text style={styles.customerInitial}>
          {item.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.customerInfo}>
        <View style={styles.customerHeader}>
          <Text style={styles.customerName}>{item.displayName}</Text>
          {item.isAdmin && (
            <View style={styles.adminBadge}>
              <Shield size={12} color={Colors.primary} />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
          {item.isBlocked && (
            <View style={styles.blockedBadge}>
              <UserX size={12} color={Colors.danger} />
              <Text style={styles.blockedBadgeText}>محظور</Text>
            </View>
          )}
        </View>
        <Text style={styles.customerEmail}>{item.email}</Text>
        <View style={styles.customerStats}>
          <Text style={styles.customerStat}>
            {item.totalOrders} طلب - Orders • ${item.totalSpent.toFixed(2)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="بحث عن عميل - Search customer"
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            testID="search-input"
          />
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing || customersQuery.isLoading}
          testID="refresh-button"
        >
          <RefreshCw
            size={20}
            color={refreshing || customersQuery.isLoading ? Colors.textLight : Colors.primary}
          />
        </TouchableOpacity>
      </View>

      {customersQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredCustomers}
          renderItem={renderCustomerItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={64} color={Colors.textLight} />
              <Text style={styles.emptyText}>لا يوجد عملاء - No customers found</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>تفاصيل العميل - Customer Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} testID="close-modal">
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedCustomer && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.customerAvatarLarge}>
                  <Text style={styles.customerInitialLarge}>
                    {selectedCustomer.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <Text style={styles.customerNameLarge}>{selectedCustomer.displayName}</Text>

                <View style={styles.section}>
                  <View style={styles.infoRow}>
                    <Mail size={20} color={Colors.primary} />
                    <Text style={styles.infoText}>{selectedCustomer.email}</Text>
                  </View>
                  {selectedCustomer.phone && (
                    <View style={styles.infoRow}>
                      <Phone size={20} color={Colors.primary} />
                      <Text style={styles.infoText}>{selectedCustomer.phone}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>الإحصائيات - Statistics</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>{selectedCustomer.totalOrders}</Text>
                      <Text style={styles.statLabel}>إجمالي الطلبات{'\n'}Total Orders</Text>
                    </View>
                    <View style={styles.statBox}>
                      <Text style={styles.statValue}>${selectedCustomer.totalSpent.toFixed(2)}</Text>
                      <Text style={styles.statLabel}>إجمالي الإنفاق{'\n'}Total Spent</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>الإجراءات - Actions</Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      selectedCustomer.isBlocked
                        ? styles.actionButtonSuccess
                        : styles.actionButtonDanger,
                    ]}
                    onPress={() => handleBlockCustomer(selectedCustomer)}
                    disabled={updateCustomerMutation.isPending}
                    testID="block-customer-button"
                  >
                    {selectedCustomer.isBlocked ? (
                      <UserCheck size={20} color={Colors.white} />
                    ) : (
                      <UserX size={20} color={Colors.white} />
                    )}
                    <Text style={styles.actionButtonText}>
                      {selectedCustomer.isBlocked
                        ? 'إلغاء الحظر - Unblock'
                        : 'حظر العميل - Block Customer'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      selectedCustomer.isAdmin
                        ? styles.actionButtonWarning
                        : styles.actionButtonPrimary,
                    ]}
                    onPress={() => handleToggleAdmin(selectedCustomer)}
                    disabled={updateCustomerMutation.isPending}
                    testID="toggle-admin-button"
                  >
                    <Shield size={20} color={Colors.white} />
                    <Text style={styles.actionButtonText}>
                      {selectedCustomer.isAdmin
                        ? 'إزالة صلاحيات الأدمن - Remove Admin'
                        : 'ترقية لأدمن - Promote to Admin'}
                    </Text>
                  </TouchableOpacity>
                </View>
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
  headerContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  refreshButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: I18nManager.isRTL ? 0 : 8,
    marginLeft: I18nManager.isRTL ? 8 : 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  customerCard: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerCardBlocked: {
    opacity: 0.6,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  customerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: I18nManager.isRTL ? 0 : 12,
    marginLeft: I18nManager.isRTL ? 12 : 0,
  },
  customerInitial: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  customerInfo: {
    flex: 1,
  },
  customerHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  adminBadge: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.primary + '20',
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  blockedBadge: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: Colors.danger + '20',
    gap: 4,
  },
  blockedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  customerEmail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  customerStats: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 8,
  },
  customerStat: {
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
  customerAvatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  customerInitialLarge: {
    fontSize: 40,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  customerNameLarge: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 24,
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: Colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  actionButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  actionButtonDanger: {
    backgroundColor: Colors.danger,
  },
  actionButtonSuccess: {
    backgroundColor: Colors.success,
  },
  actionButtonWarning: {
    backgroundColor: Colors.warning,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
