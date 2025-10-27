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
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { Plus, Folder, Edit, Trash2, X, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from '@/components/lucide-shim';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import Colors from '@/constants/colors';
import { Category, SubCategory } from '@/types';
import SearchBar from '@/components/SearchBar';


export default function CategoriesScreen() {
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<{ categoryId: string; subCategory: SubCategory } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    nameAr: '',
    level: 0,
    order: 0,
    isActive: true,
    image: '',
  });

  const [subFormData, setSubFormData] = useState<Partial<SubCategory>>({
    name: '',
    nameAr: '',
    image: '',
    order: 0,
    isActive: true,
  });

  const [subCategories, setSubCategories] = useState<Array<{ name: string; nameAr: string; image: string; order: number }>>([
    { name: '', nameAr: '', image: '', order: 0 },
  ]);

  const [subCategoryData, setSubCategoryData] = useState<Record<string, SubCategory[]>>({});

  const queryClient = useQueryClient();

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await categoriesQuery.refetch();
    setRefreshing(false);
  }, []);


  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => [] as Category[],
    staleTime: Infinity,
  });

  React.useEffect(() => {
    console.log('[CategoriesScreen] Setting up real-time listener');
    
    const categoriesQuery = query(
      collection(db, 'categories'),
      orderBy('order', 'asc')
    );
    
    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        console.log('[CategoriesScreen] Categories updated:', snapshot.docs.length, 'documents');
        
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Category[];

        console.log('[CategoriesScreen] Categories with order:', data.map(c => `${c.name} (order: ${c.order})`).join(', '));

        queryClient.setQueryData(['categories'], data);
      },
      (error) => {
        console.error('[CategoriesScreen] Error listening to categories:', error);
      }
    );

    return () => {
      console.log('[CategoriesScreen] Cleaning up listener');
      unsubscribe();
    };
  }, [queryClient]);

  React.useEffect(() => {
    const categoryIds = categoriesQuery.data?.map(c => c.id) || [];
    
    const unsubscribers: Array<() => void> = [];

    categoryIds.forEach(categoryId => {
      const subCatQuery = query(
        collection(db, 'categories', categoryId, 'subcategory'),
        orderBy('order', 'asc')
      );

      const unsubscribe = onSnapshot(
        subCatQuery,
        (snapshot) => {
          const subCats = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as SubCategory[];

          setSubCategoryData(prev => ({
            ...prev,
            [categoryId]: subCats,
          }));
        },
        (error) => {
          console.error('[CategoriesScreen] Error listening to subcategories:', error);
        }
      );

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [categoriesQuery.data]);

  const addCategoryMutation = useMutation({
    mutationFn: async (category: Partial<Category>) => {
      const slug = category.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';

      const dataToSave: any = {
        name: category.name,
        nameAr: category.nameAr,
        level: 0,
        slug,
        order: category.order || 0,
        isActive: category.isActive !== false,
        image: category.image || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'categories'), dataToSave);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم إضافة الفئة بنجاح - Category added successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Category> }) => {
      const slug = data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';

      const dataToUpdate: any = {
        name: data.name,
        nameAr: data.nameAr,
        level: 0,
        slug,
        order: data.order || 0,
        isActive: data.isActive !== false,
        image: data.image || '',
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, 'categories', id), dataToUpdate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم تحديث الفئة بنجاح - Category updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'categories', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      Alert.alert('نجح - Success', 'تم حذف الفئة بنجاح - Category deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const addSubCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, subCategory }: { categoryId: string; subCategory: Partial<SubCategory> }) => {
      const dataToSave: any = {
        id: '',
        name: subCategory.name,
        nameAr: subCategory.nameAr,
        image: subCategory.image || '',
        order: subCategory.order || 0,
        isActive: subCategory.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = doc(collection(db, 'categories', categoryId, 'subcategory'));
      dataToSave.id = docRef.id;
      await setDoc(docRef, dataToSave);
      return docRef.id;
    },
    onSuccess: () => {
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم إضافة الفئة الفرعية بنجاح - Subcategory added successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const updateSubCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, subCategoryId, data }: { categoryId: string; subCategoryId: string; data: Partial<SubCategory> }) => {
      const dataToUpdate: any = {
        name: data.name,
        nameAr: data.nameAr,
        image: data.image || '',
        order: data.order || 0,
        isActive: data.isActive !== false,
        updatedAt: new Date(),
      };

      await updateDoc(doc(db, 'categories', categoryId, 'subcategory', subCategoryId), dataToUpdate);
    },
    onSuccess: () => {
      setModalVisible(false);
      resetForm();
      Alert.alert('نجح - Success', 'تم تحديث الفئة الفرعية بنجاح - Subcategory updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const deleteSubCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, subCategoryId }: { categoryId: string; subCategoryId: string }) => {
      await deleteDoc(doc(db, 'categories', categoryId, 'subcategory', subCategoryId));
    },
    onSuccess: () => {
      Alert.alert('نجح - Success', 'تم حذف الفئة الفرعية بنجاح - Subcategory deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('خطأ - Error', error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      nameAr: '',
      level: 0,
      order: 0,
      isActive: true,
      image: '',
    });
    setSubFormData({
      name: '',
      nameAr: '',
      image: '',
      order: 0,
      isActive: true,
    });
    setSubCategories([{ name: '', nameAr: '', image: '', order: 0 }]);
    setEditingCategory(null);
    setEditingSubCategory(null);
    setSelectedCategoryForSub(null);
  };

  const handleOpenModal = (category?: Category, categoryIdForSub?: string, subCategory?: { categoryId: string; subCategory: SubCategory }) => {
    if (category) {
      setEditingCategory(category);
      setFormData(category);
    } else if (categoryIdForSub) {
      resetForm();
      setSelectedCategoryForSub(categoryIdForSub);
    } else if (subCategory) {
      setEditingSubCategory(subCategory);
      setSubFormData(subCategory.subCategory);
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (editingSubCategory) {
      if (!subFormData.name || !subFormData.nameAr) {
        Alert.alert('خطأ - Error', 'يرجى ملء جميع الحقول المطلوبة - Please fill all required fields');
        return;
      }
      updateSubCategoryMutation.mutate({
        categoryId: editingSubCategory.categoryId,
        subCategoryId: editingSubCategory.subCategory.id,
        data: subFormData,
      });
    } else if (selectedCategoryForSub) {
      if (!subFormData.name || !subFormData.nameAr) {
        Alert.alert('خطأ - Error', 'يرجى ملء جميع الحقول المطلوبة - Please fill all required fields');
        return;
      }
      addSubCategoryMutation.mutate({
        categoryId: selectedCategoryForSub,
        subCategory: subFormData,
      });
    } else {
      if (!formData.name || !formData.nameAr) {
        Alert.alert('خطأ - Error', 'يرجى ملء جميع الحقول المطلوبة - Please fill all required fields');
        return;
      }

      if (editingCategory) {
        updateCategoryMutation.mutate({ id: editingCategory.id, data: formData });
      } else {
        const validSubCategories = subCategories.filter(
          (sub) => sub.name.trim() !== '' && sub.nameAr.trim() !== ''
        );

        if (validSubCategories.length > 0) {
          try {
            const slug = formData.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';
            const mainCategoryData: any = {
              name: formData.name,
              nameAr: formData.nameAr,
              level: 0,
              slug,
              order: formData.order || 0,
              isActive: formData.isActive !== false,
              image: formData.image || '',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const mainDocRef = await addDoc(collection(db, 'categories'), mainCategoryData);
            const mainCategoryId = mainDocRef.id;

            for (const subCat of validSubCategories) {
              const subCategoryData: any = {
                id: '',
                name: subCat.name,
                nameAr: subCat.nameAr,
                image: subCat.image || '',
                order: subCat.order || 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              const subDocRef = doc(collection(db, 'categories', mainCategoryId, 'subcategory'));
              subCategoryData.id = subDocRef.id;
              await setDoc(subDocRef, subCategoryData);
            }

            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setModalVisible(false);
            resetForm();
            Alert.alert(
              'نجح - Success',
              `تم إضافة الفئة الرئيسية مع ${validSubCategories.length} فئة فرعية بنجاح\n\nMain category with ${validSubCategories.length} subcategories added successfully`
            );
          } catch (error: any) {
            Alert.alert('خطأ - Error', error.message);
          }
        } else {
          addCategoryMutation.mutate(formData);
        }
      }
    }
  };

  const handleDelete = (id: string) => {
    const hasSubCategories = (subCategoryData[id] || []).length > 0;
    
    if (hasSubCategories) {
      Alert.alert(
        'خطأ - Error',
        'لا يمكن حذف فئة تحتوي على فئات فرعية - Cannot delete category with subcategories'
      );
      return;
    }

    Alert.alert(
      'تأكيد الحذف - Confirm Delete',
      'هل أنت متأكد من حذف هذه الفئة؟ - Are you sure you want to delete this category?',
      [
        { text: 'إلغاء - Cancel', style: 'cancel' },
        { text: 'حذف - Delete', style: 'destructive', onPress: () => deleteCategoryMutation.mutate(id) },
      ]
    );
  };

  const handleDeleteSubCategory = (categoryId: string, subCategoryId: string) => {
    Alert.alert(
      'تأكيد الحذف - Confirm Delete',
      'هل أنت متأكد من حذف هذه الفئة الفرعية؟ - Are you sure you want to delete this subcategory?',
      [
        { text: 'إلغاء - Cancel', style: 'cancel' },
        { text: 'حذف - Delete', style: 'destructive', onPress: () => deleteSubCategoryMutation.mutate({ categoryId, subCategoryId }) },
      ]
    );
  };

  const toggleExpand = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };


  const allMainCategories = (categoriesQuery.data || []).sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : parseInt(String(a.order || 0), 10);
    const orderB = typeof b.order === 'number' ? b.order : parseInt(String(b.order || 0), 10);
    return orderA - orderB;
  });

  const mainCategories = allMainCategories.filter((category) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = category.name.toLowerCase().includes(query);
    const nameArMatch = category.nameAr.toLowerCase().includes(query);
    const subCatsMatch = (subCategoryData[category.id] || []).some(
      (sub) => sub.name.toLowerCase().includes(query) || sub.nameAr.toLowerCase().includes(query)
    );
    return nameMatch || nameArMatch || subCatsMatch;
  });

  const getSubCategories = (categoryId: string) =>
    (subCategoryData[categoryId] || []).sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : parseInt(String(a.order || 0), 10);
      const orderB = typeof b.order === 'number' ? b.order : parseInt(String(b.order || 0), 10);
      return orderA - orderB;
    });



  const moveCategory = async (category: Category, direction: 'up' | 'down') => {
    const categories = mainCategories;
    const currentIndex = categories.findIndex(c => c.id === category.id);
    
    if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === categories.length - 1)) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetCategory = categories[targetIndex];

    try {
      await updateDoc(doc(db, 'categories', category.id), { order: targetCategory.order });
      await updateDoc(doc(db, 'categories', targetCategory.id), { order: category.order });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (error: any) {
      Alert.alert('خطأ - Error', error.message);
    }
  };

  const moveSubCategory = async (categoryId: string, subCategory: SubCategory, direction: 'up' | 'down') => {
    const subCategories = getSubCategories(categoryId);
    const currentIndex = subCategories.findIndex(c => c.id === subCategory.id);
    
    if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === subCategories.length - 1)) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetSubCategory = subCategories[targetIndex];

    try {
      await updateDoc(doc(db, 'categories', categoryId, 'subcategory', subCategory.id), { order: targetSubCategory.order });
      await updateDoc(doc(db, 'categories', categoryId, 'subcategory', targetSubCategory.id), { order: subCategory.order });
    } catch (error: any) {
      Alert.alert('خطأ - Error', error.message);
    }
  };

  const renderSubCategoryItem = (categoryId: string, item: SubCategory) => {
    return (
      <View key={item.id} style={styles.subCategoryCard}>
        <View style={styles.categoryContent}>
          <View style={styles.categoryLeft}>
            <View style={styles.categoryIcon}>
              {item.image && item.image.trim() !== '' ? (
                <Image source={{ uri: item.image }} style={styles.categoryImage} />
              ) : (
                <Folder size={20} color={Colors.primary} />
              )}
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{item.name}</Text>
              <Text style={styles.categoryNameAr}>{item.nameAr}</Text>
            </View>
          </View>
          <View style={styles.categoryActions}>
            <View style={styles.positionButtons}>
              <TouchableOpacity
                style={styles.positionButton}
                onPress={() => moveSubCategory(categoryId, item, 'up')}
                testID={`move-up-sub-${item.id}`}
              >
                <ArrowUp size={16} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.positionButton}
                onPress={() => moveSubCategory(categoryId, item, 'down')}
                testID={`move-down-sub-${item.id}`}
              >
                <ArrowDown size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenModal(undefined, undefined, { categoryId, subCategory: item })}
              testID={`edit-subcategory-${item.id}`}
            >
              <Edit size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteSubCategory(categoryId, item.id)}
              testID={`delete-subcategory-${item.id}`}
            >
              <Trash2 size={18} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderCategoryItem = (item: Category) => {
    const subCats = getSubCategories(item.id);
    const hasSubCategories = subCats.length > 0;
    const isExpanded = expandedCategories.has(item.id);

    return (
      <View key={item.id}>
        <View style={styles.categoryCard}>
          <TouchableOpacity
            style={styles.categoryContent}
            onPress={() => hasSubCategories && toggleExpand(item.id)}
            testID={`category-${item.id}`}
          >
            <View style={styles.categoryLeft}>
              {hasSubCategories && (
                <View style={styles.expandIcon}>
                  {isExpanded ? (
                    <ChevronDown size={20} color={Colors.primary} />
                  ) : (
                    <ChevronRight size={20} color={Colors.textLight} />
                  )}
                </View>
              )}
              <View style={styles.categoryIcon}>
                {item.image && item.image.trim() !== '' ? (
                  <Image source={{ uri: item.image }} style={styles.categoryImage} />
                ) : (
                  <Folder size={24} color={Colors.primary} />
                )}
              </View>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{item.name}</Text>
                <Text style={styles.categoryNameAr}>{item.nameAr}</Text>
              </View>
            </View>
            <View style={styles.categoryActions}>
              <View style={styles.positionButtons}>
                <TouchableOpacity
                  style={styles.positionButton}
                  onPress={() => moveCategory(item, 'up')}
                  testID={`move-up-${item.id}`}
                >
                  <ArrowUp size={16} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.positionButton}
                  onPress={() => moveCategory(item, 'down')}
                  testID={`move-down-${item.id}`}
                >
                  <ArrowDown size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleOpenModal(undefined, item.id)}
                testID={`add-sub-${item.id}`}
              >
                <Plus size={18} color={Colors.success} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleOpenModal(item)}
                testID={`edit-category-${item.id}`}
              >
                <Edit size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDelete(item.id)}
                testID={`delete-category-${item.id}`}
              >
                <Trash2 size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>

        {hasSubCategories && isExpanded && (
          <View style={styles.subCategoriesContainer}>
            {subCats.map((subCat) => renderSubCategoryItem(item.id, subCat))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="ابحث عن فئة - Search category"
      />

      {categoriesQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={mainCategories}
          renderItem={({ item }) => renderCategoryItem(item)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Folder size={64} color={Colors.textLight} />
              <Text style={styles.emptyText}>لا توجد فئات - No categories found</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => handleOpenModal()}
        testID="add-category-button"
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
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory
                  ? 'تعديل فئة - Edit Category'
                  : editingSubCategory
                  ? 'تعديل فئة فرعية - Edit Subcategory'
                  : selectedCategoryForSub
                  ? 'إضافة فئة فرعية - Add Subcategory'
                  : 'إضافة فئة رئيسية - Add Main Category'}
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
              {selectedCategoryForSub || editingSubCategory ? (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>الاسم بالإنجليزية - Name (EN) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={subFormData.name}
                      onChangeText={(text) => setSubFormData({ ...subFormData, name: text })}
                      placeholder="Subcategory name"
                      testID="subcategory-name-input"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>الاسم بالعربية - Name (AR) *</Text>
                    <TextInput
                      style={[styles.textInput, { textAlign: 'right' }]}
                      value={subFormData.nameAr}
                      onChangeText={(text) => setSubFormData({ ...subFormData, nameAr: text })}
                      placeholder="اسم الفئة الفرعية"
                      testID="subcategory-name-ar-input"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>رابط الصورة - Image URL (اختياري - Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={subFormData.image}
                      onChangeText={(text) => setSubFormData({ ...subFormData, image: text })}
                      placeholder="https://example.com/image.jpg"
                      keyboardType="url"
                      autoCapitalize="none"
                      testID="subcategory-image-url-input"
                    />
                    {subFormData.image && subFormData.image.trim() !== '' ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: subFormData.image }} style={styles.imagePreview} />
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>الترتيب - Order</Text>
                    <TextInput
                      style={styles.textInput}
                      value={subFormData.order?.toString()}
                      onChangeText={(text) => setSubFormData({ ...subFormData, order: parseInt(text) || 0 })}
                      placeholder="0"
                      keyboardType="number-pad"
                      testID="subcategory-order-input"
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>الاسم بالإنجليزية - Name (EN) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formData.name}
                      onChangeText={(text) => setFormData({ ...formData, name: text })}
                      placeholder="Category name"
                      testID="category-name-input"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>الاسم بالعربية - Name (AR) *</Text>
                    <TextInput
                      style={[styles.textInput, { textAlign: 'right' }]}
                      value={formData.nameAr}
                      onChangeText={(text) => setFormData({ ...formData, nameAr: text })}
                      placeholder="اسم الفئة"
                      testID="category-name-ar-input"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>الترتيب - Order</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formData.order?.toString()}
                      onChangeText={(text) => setFormData({ ...formData, order: parseInt(text) || 0 })}
                      placeholder="0"
                      keyboardType="number-pad"
                      testID="category-order-input"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>رابط الصورة - Image URL (اختياري - Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formData.image}
                      onChangeText={(text) => setFormData({ ...formData, image: text })}
                      placeholder="https://example.com/image.jpg"
                      keyboardType="url"
                      autoCapitalize="none"
                      testID="category-image-url-input"
                    />
                    {formData.image && formData.image.trim() !== '' ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: formData.image }} style={styles.imagePreview} />
                      </View>
                    ) : null}
                  </View>

                  {!editingCategory && (
                    <View style={styles.subCategoriesSection}>
                      <View style={styles.subCategoriesHeader}>
                        <Text style={styles.subCategoriesTitle}>
                          الفئات الفرعية - Subcategories (اختياري - Optional)
                        </Text>
                        <TouchableOpacity
                          style={styles.addSubButton}
                          onPress={() =>
                            setSubCategories([...subCategories, { name: '', nameAr: '', image: '', order: subCategories.length }])
                          }
                          testID="add-subcategory-field"
                        >
                          <Plus size={16} color={Colors.primary} />
                          <Text style={styles.addSubButtonText}>إضافة - Add</Text>
                        </TouchableOpacity>
                      </View>

                      {subCategories.map((subCat, index) => (
                        <View key={index} style={styles.subCategoryItem}>
                          <View style={styles.subCategoryHeader}>
                            <Text style={styles.subCategoryLabel}>فئة فرعية {index + 1}</Text>
                            {subCategories.length > 1 && (
                              <TouchableOpacity
                                onPress={() => {
                                  const newSubs = subCategories.filter((_, i) => i !== index);
                                  setSubCategories(newSubs);
                                }}
                                testID={`remove-subcategory-${index}`}
                              >
                                <X size={18} color={Colors.danger} />
                              </TouchableOpacity>
                            )}
                          </View>

                          <View style={styles.subCategoryInputs}>
                            <View style={styles.subInputGroup}>
                              <Text style={styles.subLabel}>EN</Text>
                              <TextInput
                                style={styles.subTextInput}
                                value={subCat.name}
                                onChangeText={(text) => {
                                  const newSubs = [...subCategories];
                                  newSubs[index].name = text;
                                  setSubCategories(newSubs);
                                }}
                                placeholder="Subcategory name"
                                testID={`subcategory-name-${index}`}
                              />
                            </View>

                            <View style={styles.subInputGroup}>
                              <Text style={styles.subLabel}>AR</Text>
                              <TextInput
                                style={[styles.subTextInput, { textAlign: 'right' }]}
                                value={subCat.nameAr}
                                onChangeText={(text) => {
                                  const newSubs = [...subCategories];
                                  newSubs[index].nameAr = text;
                                  setSubCategories(newSubs);
                                }}
                                placeholder="اسم الفئة الفرعية"
                                testID={`subcategory-name-ar-${index}`}
                              />
                            </View>

                            <View style={styles.subInputGroup}>
                              <Text style={styles.subLabel}>Image</Text>
                              <TextInput
                                style={styles.subTextInput}
                                value={subCat.image}
                                onChangeText={(text) => {
                                  const newSubs = [...subCategories];
                                  newSubs[index].image = text;
                                  setSubCategories(newSubs);
                                }}
                                placeholder="https://example.com/image.jpg"
                                keyboardType="url"
                                autoCapitalize="none"
                                testID={`subcategory-image-${index}`}
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

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
                  disabled={
                    addCategoryMutation.isPending || 
                    updateCategoryMutation.isPending || 
                    addSubCategoryMutation.isPending || 
                    updateSubCategoryMutation.isPending
                  }
                  testID="save-category-button"
                >
                  {addCategoryMutation.isPending || 
                   updateCategoryMutation.isPending || 
                   addSubCategoryMutation.isPending || 
                   updateSubCategoryMutation.isPending ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingCategory || editingSubCategory ? 'تحديث - Update' : 'إضافة - Add'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  categoryCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subCategoryCard: {
    backgroundColor: Colors.backgroundDark,
    borderRadius: 12,
    marginBottom: 8,
    marginLeft: I18nManager.isRTL ? 0 : 32,
    marginRight: I18nManager.isRTL ? 32 : 0,
  },
  categoryContent: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  categoryLeft: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  expandIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  categoryNameAr: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  categoryActions: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subCategoriesContainer: {
    marginBottom: 8,
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
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
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

  subCategoriesSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  subCategoriesHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subCategoriesTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  addSubButton: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: 6,
  },
  addSubButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  subCategoryItem: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subCategoryHeader: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subCategoryLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  subCategoryInputs: {
    gap: 8,
  },
  subInputGroup: {
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    gap: 8,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    width: 30,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  subTextInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  positionButtons: {
    flexDirection: 'column',
    gap: 2,
    marginRight: I18nManager.isRTL ? 0 : 6,
    marginLeft: I18nManager.isRTL ? 6 : 0,
  },
  positionButton: {
    width: 28,
    height: 20,
    borderRadius: 4,
    backgroundColor: Colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover' as const,
  },
  imagePreviewContainer: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },

});
