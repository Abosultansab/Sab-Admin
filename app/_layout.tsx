import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { setupNotificationChannel, requestNotificationPermissions } from "@/services/notificationService";
import { startOrderListener, stopOrderListener } from "@/services/orderListenerService";
import * as Notifications from 'expo-notifications';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, loading, isAdmin } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[RootLayoutNav] Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[RootLayoutNav] Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      if (data?.type === 'new_order' && data?.orderId) {
        console.log('[RootLayoutNav] Navigating to orders screen for order:', data.orderId);
        router.push('/(tabs)/orders');
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

  useEffect(() => {
    if (user && isAdmin) {
      console.log('[RootLayoutNav] Admin logged in, requesting notification permissions');
      requestNotificationPermissions().then((token) => {
        if (token) {
          console.log('[RootLayoutNav] Notification token received:', token);
        }
      });

      console.log('[RootLayoutNav] Starting order listener');
      startOrderListener();

      return () => {
        console.log('[RootLayoutNav] Admin logged out, stopping order listener');
        stopOrderListener();
      };
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!user && inAuthGroup) {
      console.log('[RootLayoutNav] No user, redirecting to login');
      router.replace('/login');
    } else if (user && !inAuthGroup) {
      if (isAdmin) {
        console.log('[RootLayoutNav] Admin user logged in, redirecting to tabs');
        router.replace('/(tabs)');
      } else {
        console.log('[RootLayoutNav] Non-admin user detected, blocking access');
        router.replace('/login');
      }
    } else if (user && inAuthGroup && !isAdmin) {
      console.log('[RootLayoutNav] Non-admin user in tabs, redirecting to login');
      router.replace('/login');
    }
  }, [user, loading, isAdmin, segments, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    setupNotificationChannel();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
