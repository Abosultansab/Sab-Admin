import { fetchSignedUrl, uploadFileWithSignedUrl } from '../index.esm';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  I18nManager,
  Alert,
  Linking,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db } from '@/config/firebase';
import {
  User,
  HelpCircle,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Camera,
  Edit,
} from '@/components/lucide-shim';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

interface MenuItem {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  showDivider?: boolean;
}

export default function MenuScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editedName, setEditedName] = useState(user?.displayName || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'إذن مطلوب - Permission Required',
          'نحتاج إلى إذنك للوصول إلى معرض الصور - We need permission to access your photos'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      if (!result.canceled && result.assets[0]) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('خطأ - Error', 'فشل اختيار الصورة - Failed to pick image');
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!user) return;
    
    setUploadingImage(true);
    try {
      setProfileImage(downloadURL);
      
      await updateProfile(user as any, { photoURL: downloadURL });
      await updateDoc(doc(db, 'admins', user.uid), {
        photoURL: downloadURL,
        updatedAt: new Date(),
      Alert.alert(
        'نجح - Success',
        'تم تحديث صورة الملف الشخصي - Profile photo updated successfully'
      );
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('خطأ - Error', 'فشل رفع الصورة - Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSavingProfile(true);
    try {
      await updateProfile(user as any, { displayName: editedName });
      await updateDoc(doc(db, 'admins', user.uid), {
        displayName: editedName,
        updatedAt: new Date(),
      setShowProfileModal(false);
      Alert.alert(
        'نجح - Success',
        'تم تحديث الملف الشخصي - Profile updated successfully'
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('خطأ - Error', 'فشل حفظ التغييرات - Failed to save changes');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج - Logout',
      'هل أنت متأكد من تسجيل الخروج؟ - Are you sure you want to logout?',
      [
        {
          text: 'إلغاء - Cancel',
          style: 'cancel',
        },
        {
          text: 'تسجيل الخروج - Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('خطأ - Error', 'فشل تسجيل الخروج - Failed to logout');
            }
          },
        },
      ]
    );
  };

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'الحساب - Account',
      items: [
        {
          title: 'الملف الشخصي - Profile',
          subtitle: user?.email || 'admin@example.com',
          icon: <User size={24} color={colors.primary} />,
          onPress: () => {
            setEditedName(user?.displayName || '');
            setProfileImage((user as any)?.photoURL || null);
            setShowProfileModal(true);
          },
        },
      ],
    },

    {
      title: 'الإعدادات - Settings',
      items: [
        {
          title: 'الوضع المظلم - Dark Mode',
          subtitle: isDark ? 'تعطيل الوضع المظلم - Disable dark mode' : 'تفعيل الوضع المظلم - Enable dark mode',
          icon: isDark ? <Moon size={24} color={colors.warning} /> : <Sun size={24} color={colors.warning} />,
          onPress: toggleTheme,
        },
      ],
    },
    {
      title: 'الدعم - Support',
      items: [
        {
          title: 'Contact support',
          subtitle: 'WhatsApp: +966 55 750 7005',
          icon: <HelpCircle size={24} color={colors.secondary} />,
          onPress: () => {
            const url = 'https://wa.me/+966557505005';
            Linking.openURL(url).catch((err) => {
              console.error('Error opening WhatsApp:', err);
              Alert.alert(
                'خطأ - Error',
                'تعذر فتح واتساب - Unable to open WhatsApp'
              );
          },
        },
      ],
    },
    {
      title: '',
      items: [
        {
          title: 'تسجيل الخروج - Logout',
          subtitle: 'تسجيل الخروج من حسابك - Sign out of your account',
          icon: <LogOut size={24} color={colors.danger} />,
          onPress: handleLogout,
        },
      ],
    },
  ];

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.profileSection}
            onPress={() => {
              setEditedName(user?.displayName || '');
              setProfileImage((user as any)?.photoURL || null);
              setShowProfileModal(true);
            }}
            activeOpacity={0.7}
          >
            <View>
              {(user as any)?.photoURL ? (
                <Image source={{ uri: (user as any).photoURL }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <User size={32} color={colors.white} />
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                <Edit size={12} color={colors.white} />
              </View>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{user?.displayName || 'مستخدم الإدارة - Admin User'}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email || 'admin@example.com'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {menuSections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.section}>
          {section.title !== '' && (
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
          )}
          <View style={[styles.menuGroup, { backgroundColor: colors.card, shadowColor: colors.black }]}>
            {section.items.map((item, itemIndex) => (
              <TouchableOpacity
                key={itemIndex}
                style={[
                  styles.menuItem,
                  { borderBottomColor: colors.border },
                  itemIndex === section.items.length - 1 && styles.menuItemLast,
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconWrapper}>{item.icon}</View>
                  <View style={styles.menuItemText}>
                    <Text style={[styles.menuItemTitle, { color: colors.text }]}>{item.title}</Text>
                    {item.subtitle && (
                      <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                    )}
                  </View>
                </View>
                <ChevronRight size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

        <View style={styles.footer}>
          <Text style={[styles.version, { color: colors.textLight }]}>نسخة - Version 1.0.0</Text>
        </View>
      </ScrollView>

      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={[styles.modalButton, { color: colors.textSecondary }]}>إلغاء - Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSaveProfile} disabled={savingProfile}>
              <Text style={[styles.modalButton, { color: colors.primary }]}>
                {savingProfile ? 'حفظ... - Saving...' : 'حفظ - Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentInner}>
            <View style={styles.imageSection}>
              <TouchableOpacity onPress={handlePickImage} disabled={uploadingImage} activeOpacity={0.7}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} />
                ) : (
                  <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.primary }]}>
                    <User size={48} color={colors.white} />
                  </View>
                )}
                {uploadingImage ? (
                  <View style={[styles.cameraButton, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : (
                  <View style={[styles.cameraButton, { backgroundColor: colors.primary }]}>
                    <Camera size={16} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={[styles.imageHint, { color: colors.textSecondary }]}>
                اضغط لتغيير صورة الملف الشخصي - Tap to change profile photo
              </Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.label, { color: colors.text }]}>الاسم - Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="أدخل اسمك - Enter your name"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.label, { color: colors.text }]}>البريد الإلكتروني - Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, color: colors.textSecondary, borderColor: colors.border }]}
                value={user?.email || ''}
                editable={false}
              />
              <Text style={[styles.inputHint, { color: colors.textLight }]}>
                لا يمكن تغيير البريد الإلكتروني - Email cannot be changed
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  profileSection: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  userEmail: {
    fontSize: 15,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 16,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  menuGroup: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItem: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  menuItemSubtitle: {
    fontSize: 13,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  version: {
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  modalButton: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: 24,
  },
  imageSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileImagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  imageHint: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  inputHint: {
    fontSize: 12,
    marginTop: 6,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
