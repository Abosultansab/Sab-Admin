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
  Switch,
  RefreshControl,
  Platform,
} from 'react-native';
import { Plus, Search, Package, Edit, Trash2, X, Upload, ChevronDown, Palette } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '@/config/firebase';
import Colors from '@/constants/colors';
import { Product, Category, Brand, ProductSize, ProductColor } from '@/types';
import { PRODUCT_COLORS } from '@/constants/productColors';

export default function ProductsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    price: 0,
    currency: 'USD',
    stock: 0,
    categoryMain: '',
    categorySub: '',
    brandId: '',
    images: [],
    sizes: [],
    colors: [],
    isAvailable: true,
    isFeatured: false,
    deliveryTime: '',
    rate: 0,
  });
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string>('');
  const [showCategoryPicker, setShowCategoryPicker] = useState<boolean>(false);
  const [showSubCategoryPicker, setShowSubCategoryPicker] = useState<boolean>(false);
  const [showBrandPicker, setShowBrandPicker] = useState<boolean>(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      productsQuery.refetch(),
      categoriesQuery.refetch(),
      brandsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: () => [] as Product[],
    staleTime: Infinity,
  });

  React.useEffect(() => {
    console.log('[ProductsScreen] Setting up real-time listener for products');
    
    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        console.log('[ProductsScreen] Products updated:', snapshot.docs.length, 'documents');
        
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];

        queryClient.setQueryData(['products'], data);
      },
      (error) => {
        console.error('[ProductsScreen] Error listening to products:', error);
      }
    );

    return () => {
      console.log('[ProductsScreen] Cleaning up products listener');
      unsubscribe();
    };
  }, [queryClient]);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => [] as Category[],
    staleTime: Infinity,
  });

  React.useEffect(() => {
    console.log('[ProductsScreen] Setting up real-time listener for categories');
    
    const categoriesQuery = query(
      collection(db, 'categories'),
      orderBy('order', 'asc')
    );
    
    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        console.log('[ProductsScreen] Categories updated:', snapshot.docs.length, 'documents');
        
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Category[];

        queryClient.setQueryData(['categories'], data);
      },
      (error) => {
        console.error('[ProductsScreen] Error listening to categories:', error);
      }
    );

    return () => {
      console.log('[ProductsScreen] Cleaning up categories listener');
      unsubscribe();
    };
  }, [queryClient]);

  const brandsQuery = useQuery({
    queryKey: ['brands'],
    queryFn: () => [] as Brand[],
    staleTime: Infinity,
  });

  React.useEffect(() => {
    console.log('[ProductsScreen] Setting up real-time listener for brands');
    
    const unsubscribe = onSnapshot(
      collection(db, 'brands'),
      (snapshot) => {
        console.log('[ProductsScreen] Brands updated:', snapshot.docs.length, 'documents');
        
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Brand[];

        queryClient.setQueryData(['brands'], data);
      },
      (error) => {
        console.error('[ProductsScreen] Error listening to brands:', error);
      }
    );

    return () => {
      console.log('[ProductsScreen] Cleaning up brands listener');
      unsubscribe();
    };
  }, [queryClient]);

  const addProductMutation = useMutation({
    mutationFn: async (product: Partial<Product>) => {
      console.log('[ProductsScreen] Adding product with data:', JSON.stringify(product, null, 2));
      console.log('[ProductsScreen] Category Main:', product.categoryMain);
      console.log('[ProductsScreen] Category Sub:', product.categorySub);
      
      const docRef = await addDoc(collection(db, 'products'), {
        ...product,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log('[ProductsScreen] Product added with ID:', docRef.id);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم إضافة المنتج بنجاح - Product added successfully');
    },
    onError: (error: any) => {
      console.error('[ProductsScreen] Add error:', error);
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      await updateDoc(doc(db, 'products', id), {
        ...data,
        updatedAt: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم تحديث المنتج بنجاح - Product updated successfully');
    },
    onError: (error: any) => {
      console.error('[ProductsScreen] Update error:', error);
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'products', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      Alert.alert('نجح - Success', 'تم حذف المنتج بنجاح - Product deleted successfully');
    },
    onError: (error: any) => {
      console.error('[ProductsScreen] Delete error:', error);
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const pickImage = async () => {
    try {
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
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImageUri(result.assets[0].uri);
        await uploadImage(result.assets[0].uri);
      }
    } catch (error: any) {
      console.error('[ProductsScreen] Image picker error:', error);
      Alert.alert('خطأ - Error', 'فشل اختيار الصورة - Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    console.log('[ProductsScreen] Starting image upload...');
    console.log('[ProductsScreen] Image URI:', uri);
    console.log('[ProductsScreen] Current user:', auth.currentUser?.uid);
    console.log('[ProductsScreen] Storage bucket:', storage.app.options.storageBucket);
    console.log('[ProductsScreen] Platform:', Platform.OS);
    
    try {
      if (!auth.currentUser) {
        throw new Error('يجب تسجيل الدخول أولاً - You must be signed in to upload images');
      }

      const timestamp = Date.now();
      const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filename = `products/${timestamp}_product.${extension}`;
      const storageRef = ref(storage, filename);
      
      console.log('[ProductsScreen] Uploading to path:', filename);
      console.log('[ProductsScreen] Fetching image data...');
      
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('[ProductsScreen] Blob created:', blob.size, 'bytes, type:', blob.type);
      
      console.log('[ProductsScreen] Starting upload to Firebase Storage...');
      await uploadBytes(storageRef, blob, {
        contentType: blob.type || 'image/jpeg',
      });
      console.log('[ProductsScreen] Upload complete, getting download URL...');
      
      const downloadURL = await getDownloadURL(storageRef);
      console.log('[ProductsScreen] Download URL obtained:', downloadURL);
      
      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), downloadURL],
      }));
      
      setSelectedImageUri('');
      Alert.alert('نجح - Success', 'تم رفع الصورة بنجاح - Image uploaded successfully');
    } catch (error: any) {
      console.error('[ProductsScreen] Upload error:', error);
      console.error('[ProductsScreen] Error details:', {
        name: error.name,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      
      if (error.serverResponse) {
        console.error('[ProductsScreen] Server response:', error.serverResponse);
      }
      if (error.customData) {
        console.error('[ProductsScreen] Custom data:', JSON.stringify(error.customData, null, 2));
      }
      
      let errorMessage = 'فشل رفع الصورة - Failed to upload image';
      let errorDetails = error.message;
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'ليس لديك صلاحية لرفع الصور';
        errorDetails = 'تأكد من:\n1. تسجيل دخولك كمسؤول\n2. تحديث قواعد Firebase Storage\n3. وجود مستندك في مجموعة admins';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'تم إلغاء الرفع';
        errorDetails = '';
      } else if (error.code === 'storage/unknown') {
        errorMessage = 'خطأ غير معروف';
        errorDetails = 'الأسباب المحتملة:\n1. مشكلة في الاتصال\n2. الصورة تالفة أو بتنسيق غير مدعوم\n3. راجع قواعد Storage\n4. تأكد من وجود الإنترنت';
      }
      
      const fullMessage = errorDetails ? `${errorMessage}\n\n${errorDetails}` : errorMessage;
      Alert.alert('خطأ - Error', fullMessage);
    } finally {
      setUploading(false);
      setSelectedImageUri('');
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index) || [],
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      price: 0,
      currency: 'USD',
      stock: 0,
      categoryMain: '',
      categorySub: '',
      brandId: '',
      images: [],
      sizes: [],
      colors: [],
      isAvailable: true,
      isFeatured: false,
      deliveryTime: '',
      rate: 0,
    });
    setEditingProduct(null);
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.nameAr) {
      Alert.alert('خطأ - Error', 'يرجى إدخال اسم المنتج - Please enter product name');
      return;
    }

    if (!formData.price || formData.price <= 0) {
      Alert.alert('خطأ - Error', 'يرجى إدخال سعر صحيح - Please enter a valid price');
      return;
    }

    if (!formData.categoryMain) {
      Alert.alert('خطأ - Error', 'يرجى اختيار الفئة الرئيسية - Please select main category');
      return;
    }

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      addProductMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'تأكيد الحذف - Confirm Delete',
      'هل أنت متأكد من حذف هذا المنتج؟ - Are you sure you want to delete this product?',
      [
        { text: 'إلغاء - Cancel', style: 'cancel' },
        { text: 'حذف - Delete', style: 'destructive', onPress: () => deleteProductMutation.mutate(id) },
      ]
    );
  };

  const filteredProducts = productsQuery.data?.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.nameAr.includes(searchQuery)
  );

  const mainCategories = categoriesQuery.data || [];
  const [subCategories, setSubCategories] = React.useState<any[]>([]);
  const [allSubCategoriesMap, setAllSubCategoriesMap] = React.useState<Record<string, any[]>>({});

  React.useEffect(() => {
    const categoryId = formData.categoryMain;
    
    if (!categoryId || typeof categoryId !== 'string') {
      setSubCategories([]);
      return;
    }

    const fetchSubCategories = async () => {
      try {
        const subCatCollection = collection(db, 'categories', categoryId, 'subcategory');
        const subCatQuery = query(subCatCollection, orderBy('order', 'asc'));
        const snapshot = await getDocs(subCatQuery);
        const subs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSubCategories(subs);
      } catch (error) {
        console.error('[ProductsScreen] Error fetching subcategories:', error);
        setSubCategories([]);
      }
    };

    fetchSubCategories();
  }, [formData.categoryMain]);

  React.useEffect(() => {
    const fetchAllSubCategories = async () => {
      try {
        const map: Record<string, any[]> = {};
        
        for (const category of mainCategories) {
          const subCatCollection = collection(db, 'categories', category.id, 'subcategory');
          const subCatQuery = query(subCatCollection, orderBy('order', 'asc'));
          const snapshot = await getDocs(subCatQuery);
          const subs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          map[category.id] = subs;
        }
        
        setAllSubCategoriesMap(map);
        console.log('[ProductsScreen] Loaded all subcategories map:', Object.keys(map).length, 'categories');
      } catch (error) {
        console.error('[ProductsScreen] Error fetching all subcategories:', error);
      }
    };

    if (mainCategories.length > 0) {
      fetchAllSubCategories();
    }
  }, [mainCategories]);

  const getCategoryName = (categoryId: string) => {
    if (!categoriesQuery.data || !categoryId) return categoryId || '';
    const category = categoriesQuery.data.find((cat) => cat.id === categoryId);
    return category ? `${category.name} - ${category.nameAr}` : categoryId;
  };

  const getSubCategoryName = (categoryMainId: string, subCategoryId: string) => {
    if (!categoryMainId || !subCategoryId) return '';
    
    const categorySubCats = allSubCategoriesMap[categoryMainId];
    if (!categorySubCats || categorySubCats.length === 0) {
      console.log('[ProductsScreen] No subcategories found for category:', categoryMainId);
      return subCategoryId;
    }
    
    const subCat = categorySubCats.find((sc: any) => sc.id === subCategoryId);
    if (!subCat) {
      console.log('[ProductsScreen] Subcategory not found:', subCategoryId, 'in category:', categoryMainId);
      return subCategoryId;
    }
    
    return `${subCat.name} - ${subCat.nameAr}`;
  };

  const getBrandName = (brandId: string) => {
    if (!brandsQuery.data || !brandId) return brandId || '';
    const brand = brandsQuery.data.find((b) => b.id === brandId);
    return brand ? `${brand.name} - ${brand.nameAr}` : brandId;
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => handleOpenModal(item)}
      activeOpacity={0.7}
    >
      {item.images && item.images.length > 0 && item.images[0] && item.images[0].trim() !== '' ? (
        <Image source={{ uri: item.images[0] }} style={styles.productImage} />
      ) : (
        <View style={styles.productIcon}>
          <Package size={24} color={Colors.primary} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productNameAr}>{item.nameAr}</Text>
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>{item.currency} {item.price}</Text>
          <Text style={styles.productStock}>المخزون: {item.stock}</Text>
        </View>
        {item.categorySub && (
          <Text style={styles.productCategory} numberOfLines={1}>
            {getSubCategoryName(item.categoryMain, item.categorySub)}
          </Text>
        )}
        {item.isFeatured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>مميز - Featured</Text>
          </View>
        )}
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleOpenModal(item)}
          testID={`edit-product-${item.id}`}
        >
          <Edit size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDelete(item.id)}
          testID={`delete-product-${item.id}`}
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
          placeholder="بحث عن منتج - Search product"
          placeholderTextColor={Colors.textLight}
          value={searchQuery}
          onChangeText={setSearchQuery}
          testID="search-input"
        />
      </View>

      {productsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Package size={64} color={Colors.textLight} />
              <Text style={styles.emptyText}>لا توجد منتجات - No products found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => handleOpenModal()}
        testID="add-product-button"
      >
        <Plus size={24} color={Colors.white} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'تعديل منتج - Edit Product' : 'إضافة منتج - Add Product'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} testID="close-modal">
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>الاسم بالإنجليزية - Name (EN) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Product name"
                  testID="product-name-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الاسم بالعربية - Name (AR) *</Text>
                <TextInput
                  style={[styles.textInput, { textAlign: 'right' }]}
                  value={formData.nameAr}
                  onChangeText={(text) => setFormData({ ...formData, nameAr: text })}
                  placeholder="اسم المنتج"
                  testID="product-name-ar-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الوصف بالإنجليزية - Description (EN)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Product description"
                  multiline
                  numberOfLines={4}
                  testID="product-description-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الوصف بالعربية - Description (AR)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea, { textAlign: 'right' }]}
                  value={formData.descriptionAr}
                  onChangeText={(text) => setFormData({ ...formData, descriptionAr: text })}
                  placeholder="وصف المنتج"
                  multiline
                  numberOfLines={4}
                  testID="product-description-ar-input"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>السعر - Price *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.price?.toString()}
                    onChangeText={(text) => setFormData({ ...formData, price: parseFloat(text) || 0 })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    testID="product-price-input"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.label}>العملة - Currency *</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
                    testID="currency-picker-button"
                  >
                    <Text style={styles.pickerButtonText}>{formData.currency || 'اختر - Select'}</Text>
                    <ChevronDown size={20} color={Colors.textLight} />
                  </TouchableOpacity>
                  {showCurrencyPicker && (
                    <View style={styles.pickerDropdown}>
                      {['USD', 'LBP'].map((currency) => (
                        <TouchableOpacity
                          key={currency}
                          style={styles.pickerItem}
                          onPress={() => {
                            setFormData({ ...formData, currency: currency as 'USD' | 'LBP' });
                            setShowCurrencyPicker(false);
                          }}
                        >
                          <Text style={styles.pickerItemText}>{currency}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>المخزون - Stock</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.stock?.toString()}
                  onChangeText={(text) => setFormData({ ...formData, stock: parseInt(text) || 0 })}
                  placeholder="0"
                  keyboardType="number-pad"
                  testID="product-stock-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الفئة الرئيسية - Main Category *</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                  testID="category-picker-button"
                >
                  <Text style={styles.pickerButtonText}>
                    {formData.categoryMain ? getCategoryName(formData.categoryMain) : 'اختر الفئة - Select Category'}
                  </Text>
                  <ChevronDown size={20} color={Colors.textLight} />
                </TouchableOpacity>
                {showCategoryPicker && (
                  <ScrollView style={styles.pickerDropdown} nestedScrollEnabled>
                    {mainCategories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setFormData({ ...formData, categoryMain: category.id, categorySub: '' });
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text style={styles.pickerItemText}>{category.name} - {category.nameAr}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {formData.categoryMain && subCategories.length > 0 && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>الفئة الفرعية - Sub Category (اختياري - Optional)</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowSubCategoryPicker(!showSubCategoryPicker)}
                    testID="sub-category-picker-button"
                  >
                    <Text style={styles.pickerButtonText}>
                      {formData.categorySub
                        ? (() => {
                            const subCat = subCategories.find((sc) => sc.id === formData.categorySub);
                            return subCat ? `${subCat.name} - ${subCat.nameAr}` : 'اختر الفئة الفرعية - Select Subcategory';
                          })()
                        : 'اختر الفئة الفرعية - Select Subcategory'}
                    </Text>
                    <ChevronDown size={20} color={Colors.textLight} />
                  </TouchableOpacity>
                  {showSubCategoryPicker && (
                    <ScrollView style={styles.pickerDropdown} nestedScrollEnabled>
                      {subCategories.map((category) => (
                        <TouchableOpacity
                          key={category.id}
                          style={styles.pickerItem}
                          onPress={() => {
                            setFormData({ ...formData, categorySub: category.id });
                            setShowSubCategoryPicker(false);
                          }}
                        >
                          <Text style={styles.pickerItemText}>{category.name} - {category.nameAr}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>العلامة التجارية - Brand (اختياري - Optional)</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowBrandPicker(!showBrandPicker)}
                  testID="brand-picker-button"
                >
                  <Text style={styles.pickerButtonText}>
                    {formData.brandId ? getBrandName(formData.brandId) : 'اختر العلامة - Select Brand'}
                  </Text>
                  <ChevronDown size={20} color={Colors.textLight} />
                </TouchableOpacity>
                {showBrandPicker && (
                  <ScrollView style={styles.pickerDropdown} nestedScrollEnabled>
                    {brandsQuery.data?.map((brand) => (
                      <TouchableOpacity
                        key={brand.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setFormData({ ...formData, brandId: brand.id });
                          setShowBrandPicker(false);
                        }}
                      >
                        <Text style={styles.pickerItemText}>{brand.name} - {brand.nameAr}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>المقاسات - Sizes (اختياري - Optional)</Text>
                <View style={styles.sizesContainer}>
                  {(['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'] as ProductSize[]).map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeButton,
                        formData.sizes?.includes(size) && styles.sizeButtonActive,
                      ]}
                      onPress={() => {
                        const currentSizes = formData.sizes || [];
                        if (currentSizes.includes(size)) {
                          setFormData({ ...formData, sizes: currentSizes.filter((s) => s !== size) });
                        } else {
                          setFormData({ ...formData, sizes: [...currentSizes, size] });
                        }
                      }}
                      testID={`size-${size}`}
                    >
                      <Text
                        style={[
                          styles.sizeButtonText,
                          formData.sizes?.includes(size) && styles.sizeButtonTextActive,
                        ]}
                      >
                        {size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الألوان - Colors (اختياري - Optional)</Text>
                <TouchableOpacity
                  style={styles.colorSelectionButton}
                  onPress={() => {
                    const callbackId = `colorCallback_${Date.now()}`;
                    (global as any)[callbackId] = (selectedColors: string[]) => {
                      setFormData({ ...formData, colors: selectedColors });
                      delete (global as any)[callbackId];
                    };
                    router.push({
                      pathname: '/color-selection',
                      params: {
                        selectedColors: JSON.stringify(formData.colors || []),
                        onSelect: callbackId,
                      },
                    });
                  }}
                  testID="choose-color-button"
                >
                  <View style={styles.colorSelectionContent}>
                    <Palette size={24} color={Colors.primary} />
                    <View style={styles.colorSelectionTextContainer}>
                      <Text style={styles.colorSelectionTitle}>
                        {I18nManager.isRTL ? 'اختر اللون' : 'Choose Color'}
                      </Text>
                      {formData.colors && formData.colors.length > 0 && (
                        <View style={styles.selectedColorsPreview}>
                          {formData.colors.slice(0, 5).map((color) => {
                            const colorData = PRODUCT_COLORS.find((c) => c.value === color);
                            return colorData ? (
                              <View
                                key={color}
                                style={[
                                  styles.colorDot,
                                  { backgroundColor: colorData.hex },
                                  color === 'white' && styles.whiteColorDot,
                                ]}
                              />
                            ) : null;
                          })}
                          {formData.colors.length > 5 && (
                            <Text style={styles.moreColorsText}>+{formData.colors.length - 5}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                  <ChevronDown size={20} color={Colors.textLight} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>زمن التوصيل - Delivery Time</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.deliveryTime}
                  onChangeText={(text) => setFormData({ ...formData, deliveryTime: text })}
                  placeholder="مثال: 2-3 أيام - Example: 2-3 days"
                  testID="product-delivery-time-input"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>التقييم - Rate (0-5)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.rate?.toString() || '0'}
                  onChangeText={(text) => {
                    const rate = parseFloat(text) || 0;
                    setFormData({ ...formData, rate: Math.min(5, Math.max(0, rate)) });
                  }}
                  placeholder="0.0"
                  keyboardType="decimal-pad"
                  testID="product-rate-input"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>متوفر - Available</Text>
                  <Switch
                    value={formData.isAvailable}
                    onValueChange={(value) => setFormData({ ...formData, isAvailable: value })}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                    testID="product-available-switch"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>منتج مميز - Featured</Text>
                  <Switch
                    value={formData.isFeatured}
                    onValueChange={(value) => setFormData({ ...formData, isFeatured: value })}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                    testID="product-featured-switch"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>الصور - Images (اختياري - Optional)</Text>
                <View style={styles.imageUploadSection}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
                    {formData.images?.filter(img => img && img.trim() !== '').map((image, index) => (
                      <View key={index} style={styles.imageWrapper}>
                        <Image source={{ uri: image }} style={styles.uploadedImage} />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <X size={16} color={Colors.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {selectedImageUri && selectedImageUri.trim() !== '' && (
                      <View style={styles.imageWrapper}>
                        <Image source={{ uri: selectedImageUri }} style={styles.uploadedImage} />
                        <View style={styles.uploadingOverlay}>
                          <ActivityIndicator size="small" color={Colors.white} />
                        </View>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={pickImage}
                      disabled={uploading}
                      testID="upload-image-button"
                    >
                      {uploading ? (
                        <View style={styles.uploadingContainer}>
                          <ActivityIndicator size="small" color={Colors.primary} />
                          <Text style={styles.uploadingText}>جاري الرفع...</Text>
                        </View>
                      ) : (
                        <>
                          <Upload size={24} color={Colors.primary} />
                          <Text style={styles.uploadButtonText}>اختر صورة</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                  <Text style={styles.imageHint}>يمكنك رفع عدة صور للمنتج - You can upload multiple product images</Text>
                </View>
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
                  disabled={addProductMutation.isPending || updateProductMutation.isPending}
                  testID="save-product-button"
                >
                  {addProductMutation.isPending || updateProductMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingProduct ? 'تحديث - Update' : 'إضافة - Add'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  productCard: {
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
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: I18nManager.isRTL ? 0 : 12,
    marginLeft: I18nManager.isRTL ? 12 : 0,
  },
  productIcon: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: I18nManager.isRTL ? 0 : 12,
    marginLeft: I18nManager.isRTL ? 12 : 0,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  productNameAr: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  productMeta: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 12,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  productStock: {
    fontSize: 13,
    color: Colors.textLight,
  },
  productCategory: {
    fontSize: 12,
    color: Colors.primary,
    marginTop: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  featuredBadge: {
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  featuredText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.warning,
  },
  productActions: {
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
  formRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
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
  pickerButton: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.text,
  },
  pickerDropdown: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  switchRow: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageUploadSection: {
    gap: 8,
  },
  imagesContainer: {
    flexDirection: 'row',
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  uploadedImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: Colors.background,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '10',
    gap: 4,
  },
  uploadButtonText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  uploadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadingText: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 4,
  },
  imageHint: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
    marginTop: 4,
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
  sizesContainer: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minWidth: 60,
    alignItems: 'center',
  },
  sizeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sizeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  sizeButtonTextActive: {
    color: Colors.white,
  },
  colorPickerItem: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colorPickerItemSelected: {
    backgroundColor: Colors.primary + '10',
  },
  colorPickerItemContent: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorPickerItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  colorSelectionButton: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.primary + '20',
    borderStyle: 'dashed',
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorSelectionContent: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  colorSelectionTextContainer: {
    flex: 1,
  },
  colorSelectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  selectedColorsPreview: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  whiteColorDot: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moreColorsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: I18nManager.isRTL ? 0 : 4,
    marginRight: I18nManager.isRTL ? 4 : 0,
  },
});
