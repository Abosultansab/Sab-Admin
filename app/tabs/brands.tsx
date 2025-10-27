import React, { useState } from 'react';
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
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Animated,
} from 'react-native';
import { Plus, Search, Tag, Edit, Trash2, X, Upload } from '@/components/lucide-shim';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '@/config/firebase';
import Colors from '@/constants/colors';
import { Brand } from '@/types';

export default function BrandsScreen() {
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState<Partial<Brand>>({
    name: '',
    nameAr: '',
    logo: '',
    description: '',
    descriptionAr: '',
  });
  const [uploading, setUploading] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await brandsQuery.refetch();
    setRefreshing(false);
  }, []);

  const brandsQuery = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'brands'));
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Brand[];
    },
  });

  const addBrandMutation = useMutation({
    mutationFn: async (brand: Partial<Brand>) => {
      const docRef = await addDoc(collection(db, 'brands'), {
        ...brand,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم إضافة العلامة التجارية بنجاح - Brand added successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const updateBrandMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Brand> }) => {
      await updateDoc(doc(db, 'brands', id), {
        ...data,
        updatedAt: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم تحديث العلامة التجارية بنجاح - Brand updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const deleteBrandMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'brands', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      Alert.alert('نجح - Success', 'تم حذف العلامة التجارية بنجاح - Brand deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('خطأ - Error', 'يجب السماح بالوصول للصور - Permission to access photos is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `brands/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      setFormData((prev) => ({
        ...prev,
        logo: downloadURL,
      }));
    } catch (error: any) {
      console.error('[BrandsScreen] Upload error:', error);
      Alert.alert('خطأ - Error', 'فشل رفع الصورة - Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      nameAr: '',
      logo: '',
      description: '',
      descriptionAr: '',
    });
    setEditingBrand(null);
  };

  const handleOpenModal = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setFormData(brand);
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.nameAr) {
      Alert.alert('خطأ - Error', 'يرجى ملء جميع الحقول المطلوبة - Please fill all required fields');
      return;
    }

    if (editingBrand) {
      updateBrandMutation.mutate({ id: editingBrand.id, data: formData });
    } else {
      addBrandMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'تأكيد الحذف - Confirm Delete',
      'هل أنت متأكد من حذف هذه العلامة التجارية؟ - Are you sure you want to delete this brand?',
      [
        { text: 'إلغاء - Cancel', style: 'cancel' },
        { text: 'حذف - Delete', style: 'destructive', onPress: () => deleteBrandMutation.mutate(id) },
      ]
    );
  };

  const filteredBrands = brandsQuery.data?.filter(
    (brand) =>
      brand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      brand.nameAr.includes(searchQuery)
  );

  const renderBrandItem = ({ item }: { item: Brand }) => (
    <TouchableOpacity 
      style={styles.brandCard}
      onPress={() => handleOpenModal(item)}
      activeOpacity={0.7}
    >
      {item.logo && item.logo.trim() !== '' ? (
        <Image source={{ uri: item.logo }} style={styles.brandLogo} />
      ) : (
        <View style={styles.brandIcon}>
          <Tag size={24} color={Colors.primary} />
        </View>
      )}
      <View style={styles.brandInfo}>
        <Text style={styles.brandName}>{item.name}</Text>
        <Text style={styles.brandNameAr}>{item.nameAr}</Text>
        {item.description && (
          <Text style={styles.brandDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <View style={styles.brandActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleOpenModal(item)}
          testID={`edit-brand-${item.id}`}
        >
          <Edit size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item.id)}
          testID={`delete-brand-${item.id}`}
        >
          <Trash2 size={20} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="بحث عن علامة تجارية - Search brand"
          placeholderTextColor={Colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="search-input"
        />
      </View>

      {brandsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredBrands}
          renderItem={renderBrandItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Tag size={64} color={Colors.textLight} />
              <Text style={styles.emptyText}>لا توجد علامات تجارية - No brands found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => handleOpenModal()}
        testID="add-brand-button"
      >
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBrand ? 'تعديل علامة تجارية - Edit Brand' : 'إضافة علامة تجارية - Add Brand'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} testID="close-modal">
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBody} 
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formGroup}>
                <Text style={styles.label}>الشعار - Logo</Text>
                <View style={styles.logoContainer}>
                  {formData.logo && formData.logo.trim() !== '' ? (
                    <View style={styles.logoWrapper}>
                      <Image source={{ uri: formData.logo }} style={styles.uploadedLogo} />
                      <TouchableOpacity
                        style={styles.removeLogoButton}
                        onPress={() => setFormData({ ...formData, logo: '' })}
                      >
                        <X size={16} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={pickImage}
                      disabled={uploading}
                      testID="upload-logo-button"
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <>
                          <Upload size={24} color={Colors.primary} />
                          <Text style={styles.uploadText}>رفع شعار - Upload Logo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الاسم بالإنجليزية - Name (EN) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Brand name"
                  testID="brand-name-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الاسم بالعربية - Name (AR) *</Text>
                <TextInput
                  style={[styles.textInput, { textAlign: 'right' }]}
                  value={formData.nameAr}
                  onChangeText={(text) => setFormData({ ...formData, nameAr: text })}
                  placeholder="اسم العلامة التجارية"
                  testID="brand-name-ar-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الوصف بالإنجليزية - Description (EN)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Brand description"
                  multiline
                  numberOfLines={4}
                  testID="brand-description-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الوصف بالعربية - Description (AR)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, { textAlign: 'right' }]}
                  value={formData.descriptionAr}
                  onChangeText={(text) => setFormData({ ...formData, descriptionAr: text })}
                  placeholder="وصف العلامة التجارية"
                  multiline
                  numberOfLines={4}
                  testID="brand-description-ar-input"
                />
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>إلغاء - Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSave}
                  disabled={addBrandMutation.isPending || updateBrandMutation.isPending}
                  testID="save-brand-button"
                >
                  {addBrandMutation.isPending || updateBrandMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingBrand ? 'تحديث - Update' : 'إضافة - Add'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
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
    padding: 16,
    paddingBottom: 80,
  },
  brandCard: {
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
  brandLogo: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: I18nManager.isRTL ? 0 : 12,
    marginLeft: I18nManager.isRTL ? 12 : 0,
  },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: I18nManager.isRTL ? 0 : 12,
    marginLeft: I18nManager.isRTL ? 12 : 0,
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  brandNameAr: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  brandDescription: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  brandActions: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
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
  fab: {
    position: 'absolute',
    right: I18nManager.isRTL ? undefined : 16,
    left: I18nManager.isRTL ? 16 : undefined,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoWrapper: {
    position: 'relative',
  },
  uploadedLogo: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  removeLogoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 8,
  },
  uploadText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 12,
    marginTop: 24,
    paddingBottom: 20,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
