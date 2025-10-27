export interface Brand {
  id: string;
  name: string;
  nameAr: string;
  logo?: string;
  description?: string;
  descriptionAr?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  level: number;
  slug?: string;
  icon?: string;
  image?: string;
  order: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface SubCategory {
  id: string;
  name: string;
  nameAr: string;
  image?: string;
  order: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export type ProductSize = 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '4XL' | '5XL' | '6XL';

export interface ProductColor {
  id: string;
  value: string;
  nameEn: string;
  nameAr: string;
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  currency: 'USD' | 'LBP';
  stock: number;
  categoryMain: string;
  categorySub?: string;
  brandId?: string;
  images: string[];
  sizes?: ProductSize[];
  colors?: string[];
  isAvailable: boolean;
  isFeatured: boolean;
  deliveryTime?: string;
  discount?: number;
  rate?: number;
  specifications?: Record<string, string>;
  createdAt: any;
  updatedAt: any;
}

export type OrderStatus = 
  | 'received'
  | 'under_review'
  | 'preparing'
  | 'shipped'
  | 'arrived_hub'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'delivery_failed'
  | 'awaiting_payment';

export interface OrderItem {
  productId: string;
  productName: string;
  productNameAr: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface StatusTimelineEntry {
  status: OrderStatus;
  timestamp: any;
  note?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  subtotalAmount: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  statusTimeline: StatusTimelineEntry[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed';
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

export interface Customer {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  photoURL?: string;
  isBlocked: boolean;
  isAdmin: boolean;
  totalOrders: number;
  totalSpent: number;
  fcmToken?: string;
  createdAt: any;
  lastLoginAt: any;
}

export interface Notification {
  id: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  targetType: 'all' | 'specific' | 'admins';
  targetUserIds?: string[];
  imageUrl?: string;
  data?: Record<string, string>;
  sentAt: any;
  sentBy: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  recentOrders: Order[];
}

export type ActivityLogType = 
  | 'order_status_change'
  | 'notification_sent'
  | 'customer_ban'
  | 'customer_unban'
  | 'promotion_created'
  | 'invoice_generated'
  | 'user_created'
  | 'user_deleted'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted';

export interface ActivityLog {
  id: string;
  type: ActivityLogType;
  action: string;
  actionAr: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
  timestamp: any;
  ipAddress?: string;
}

export interface DailyStats {
  id: string;
  date: string;
  orders: number;
  revenue: number;
  newCustomers: number;
  deliveredOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }>;
  createdAt: any;
  updatedAt: any;
}

export interface DashboardKPIs {
  ordersToday: number;
  ordersWeek: number;
  ordersMonth: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  newCustomersToday: number;
  newCustomersWeek: number;
  newCustomersMonth: number;
  last14DaysData: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
}
