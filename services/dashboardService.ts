import { collection, query, where, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { DailyStats, DashboardKPIs, Order } from '@/types';

export const updateDailyStats = async (date: string): Promise<void> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay))
    );

    const ordersSnapshot = await getDocs(ordersQuery);
    const orders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];

    let revenue = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;
    const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};

    orders.forEach(order => {
      revenue += order.totalAmount || 0;
      
      if (order.status === 'delivered') {
        deliveredOrders++;
      }
      if (order.status === 'cancelled') {
        cancelledOrders++;
      }

      order.items.forEach(item => {
        if (!productStats[item.productId]) {
          productStats[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0,
          };
        }
        productStats[item.productId].quantity += item.quantity;
        productStats[item.productId].revenue += item.price * item.quantity;
      });
    });

    const topProducts = Object.entries(productStats)
      .map(([productId, stats]) => ({
        productId,
        productName: stats.name,
        quantity: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const customersQuery = query(
      collection(db, 'users'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay))
    );
    const customersSnapshot = await getDocs(customersQuery);
    const newCustomers = customersSnapshot.size;

    const averageOrderValue = orders.length > 0 ? revenue / orders.length : 0;

    const dailyStats: Omit<DailyStats, 'id'> = {
      date,
      orders: orders.length,
      revenue,
      newCustomers,
      deliveredOrders,
      cancelledOrders,
      averageOrderValue,
      topProducts,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'dailyStats', date), dailyStats);
    console.log('[Dashboard] Daily stats updated for:', date);
  } catch (error) {
    console.error('[Dashboard] Error updating daily stats:', error);
    throw error;
  }
};

export const getDashboardKPIs = async (): Promise<DashboardKPIs> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const ordersQuery = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(monthAgo))
    );
    const ordersSnapshot = await getDocs(ordersQuery);
    const allOrders = ordersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Order[];

    const todayOrders = allOrders.filter(order => {
      const orderDate = order.createdAt?.toDate?.();
      return orderDate && orderDate >= today;
    });

    const weekOrders = allOrders.filter(order => {
      const orderDate = order.createdAt?.toDate?.();
      return orderDate && orderDate >= weekAgo;
    });

    const monthOrders = allOrders;

    const revenueToday = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const revenueWeek = weekOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const revenueMonth = monthOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    const customersQuery = query(
      collection(db, 'users'),
      where('createdAt', '>=', Timestamp.fromDate(monthAgo))
    );
    const customersSnapshot = await getDocs(customersQuery);
    const allCustomers = customersSnapshot.docs.map(doc => doc.data());

    const newCustomersToday = allCustomers.filter(customer => {
      const createdAt = customer.createdAt?.toDate?.();
      return createdAt && createdAt >= today;
    }).length;

    const newCustomersWeek = allCustomers.filter(customer => {
      const createdAt = customer.createdAt?.toDate?.();
      return createdAt && createdAt >= weekAgo;
    }).length;

    const newCustomersMonth = allCustomers.length;

    const last14Days: Array<{ date: string; orders: number; revenue: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayOrders = allOrders.filter(order => {
        const orderDate = order.createdAt?.toDate?.();
        if (!orderDate) return false;
        const orderDateStr = orderDate.toISOString().split('T')[0];
        return orderDateStr === dateStr;
      });

      const dayRevenue = dayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

      last14Days.push({
        date: dateStr,
        orders: dayOrders.length,
        revenue: dayRevenue,
      });
    }

    return {
      ordersToday: todayOrders.length,
      ordersWeek: weekOrders.length,
      ordersMonth: monthOrders.length,
      revenueToday,
      revenueWeek,
      revenueMonth,
      newCustomersToday,
      newCustomersWeek,
      newCustomersMonth,
      last14DaysData: last14Days,
    };
  } catch (error) {
    console.error('[Dashboard] Error fetching dashboard KPIs:', error);
    throw error;
  }
};

export const ensureTodayStats = async (): Promise<void> => {
  try {
    if (!auth.currentUser) {
      console.log('[Dashboard] No authenticated user, skipping stats creation');
      return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const statsDoc = await getDoc(doc(db, 'dailyStats', todayStr));
    
    if (!statsDoc.exists()) {
      await updateDailyStats(todayStr);
    }
  } catch (error) {
    console.log('[Dashboard] Stats will be created when admin logs in');
  }
};
