import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  addDoc,
  updateDoc,
  setDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
  where,
  DocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import {
  LegacyAccountCategory,
  LegacyAccountItem,
  CreateAccountCategoryInput,
  UpdateAccountCategoryInput,
  LegacyCreateAccountItemInput,
  LegacyUpdateAccountItemInput,
  FlatAccountItem,
  DEFAULT_ACCOUNT_STRUCTURE
} from '@/types/account-items';

// --- Constants ---
const ACCOUNT_CATEGORIES_COLLECTION = 'accountCategories';
const ACCOUNT_ITEMS_COLLECTION = 'accountItems';

// --- Helper Functions ---
const convertCategoryDoc = (doc: DocumentSnapshot<DocumentData>): LegacyAccountCategory => {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }
  return {
    id: doc.id,
    mediaId: data.mediaId,
    name: data.name,
    order: data.order || 0,
    items: [],
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
};

const convertItemDoc = (doc: DocumentSnapshot<DocumentData>): LegacyAccountItem => {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }
  return {
    id: doc.id,
    mediaId: data.mediaId,
    name: data.name,
    categoryId: data.categoryId,
    order: data.order || 0,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
};

// --- Category Management ---

export async function getAccountCategories(mediaId: string): Promise<LegacyAccountCategory[]> {
  try {
    const catQuery = query(
      collection(db, ACCOUNT_CATEGORIES_COLLECTION),
      where('mediaId', '==', mediaId),
      orderBy('order', 'asc')
    );
    const catSnapshot = await getDocs(catQuery);
    const categories = catSnapshot.docs.map(convertCategoryDoc);

    const itemQuery = query(
      collection(db, ACCOUNT_ITEMS_COLLECTION),
      where('mediaId', '==', mediaId),
      orderBy('order', 'asc')
    );
    const itemSnapshot = await getDocs(itemQuery);
    const allItems = itemSnapshot.docs.map(convertItemDoc);

    for (const category of categories) {
      category.items = allItems.filter(item => item.categoryId === category.id);
    }

    return categories;
  } catch (error) {
    console.error('Error getting account categories:', error);
    throw error;
  }
}

export async function createAccountCategory(mediaId: string, input: CreateAccountCategoryInput): Promise<string> {
  try {
    const now = new Date();
    const order = input.order ?? await getNextCategoryOrder(mediaId);

    const categoryData = {
      mediaId,
      name: input.name,
      order,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, ACCOUNT_CATEGORIES_COLLECTION), categoryData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating account category:', error);
    throw error;
  }
}

export async function updateAccountCategory(categoryId: string, input: UpdateAccountCategoryInput): Promise<void> {
  try {
    const docRef = doc(db, ACCOUNT_CATEGORIES_COLLECTION, categoryId);
    const updateData: Record<string, string | number | Date> = { updatedAt: new Date() };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.order !== undefined) updateData.order = input.order;

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating account category:', error);
    throw error;
  }
}

export async function deleteAccountCategory(categoryId: string, mediaId?: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    const categoryRef = doc(db, ACCOUNT_CATEGORIES_COLLECTION, categoryId);

    // mediaIdが提供されていない場合は、ドキュメントから取得を試行
    if (!mediaId) {
      const categoryDoc = await getDoc(categoryRef);
      mediaId = categoryDoc.data()?.mediaId;

      if (!mediaId) throw new Error('Category does not have a mediaId and none was provided.');
    }

    const itemsQuery = query(
      collection(db, ACCOUNT_ITEMS_COLLECTION),
      where('mediaId', '==', mediaId),
      where('categoryId', '==', categoryId)
    );
    const itemsSnapshot = await getDocs(itemsQuery);
    itemsSnapshot.forEach(doc => batch.delete(doc.ref));

    batch.delete(categoryRef);
    await batch.commit();
  } catch (error) {
    console.error('Error deleting account category:', error);
    throw error;
  }
}

// --- Item Management ---

export async function createAccountItem(mediaId: string, input: LegacyCreateAccountItemInput): Promise<string> {
  try {
    const now = new Date();
    const order = input.order ?? await getNextItemOrder(mediaId, input.categoryId);

    const itemData = {
      mediaId,
      name: input.name,
      categoryId: input.categoryId,
      order,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, ACCOUNT_ITEMS_COLLECTION), itemData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating account item:', error);
    throw error;
  }
}

export async function updateAccountItem(itemId: string, input: LegacyUpdateAccountItemInput): Promise<void> {
  try {
    const docRef = doc(db, ACCOUNT_ITEMS_COLLECTION, itemId);
    const updateData: Record<string, string | number | Date> = { updatedAt: new Date() };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
    if (input.order !== undefined) updateData.order = input.order;

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating account item:', error);
    throw error;
  }
}

export async function deleteAccountItem(itemId: string): Promise<void> {
  try {
    const docRef = doc(db, ACCOUNT_ITEMS_COLLECTION, itemId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting account item:', error);
    throw error;
  }
}

// --- Utility Functions ---

async function getNextCategoryOrder(mediaId: string): Promise<number> {
  const categories = await getAccountCategories(mediaId);
  return categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 1;
}

async function getNextItemOrder(mediaId: string, categoryId: string): Promise<number> {
  const q = query(
    collection(db, ACCOUNT_ITEMS_COLLECTION),
    where('mediaId', '==', mediaId),
    where('categoryId', '==', categoryId)
  );
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(convertItemDoc);
  return items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 1;
}

export async function getFlatAccountItems(mediaId: string): Promise<FlatAccountItem[]> {
  const categories = await getAccountCategories(mediaId);
  const flatItems: FlatAccountItem[] = [];

  categories.forEach(category => {
    flatItems.push({ id: `category-${category.id}`, name: category.name, categoryId: category.id, categoryName: category.name, fullName: category.name, isCategory: true, order: category.order * 1000 });
    category.items.forEach(item => {
      flatItems.push({ id: item.id, name: item.name, categoryId: item.categoryId, categoryName: category.name, fullName: `${category.name} > ${item.name}`, isCategory: false, order: category.order * 1000 + item.order });
    });
  });

  return flatItems.sort((a, b) => a.order - b.order);
}

// --- Initialization & Migration ---

export async function initializeDefaultAccountStructure(mediaId: string): Promise<void> {
  try {
    const existingCategories = await getAccountCategories(mediaId);
    if (existingCategories.length > 0) {
      console.log(`Account structure for media ${mediaId} already initialized`);
      return;
    }

    console.log(`Initializing default account structure for media ${mediaId}...`);
    const batch = writeBatch(db);

    for (const categoryTemplate of DEFAULT_ACCOUNT_STRUCTURE) {
      const categoryRef = doc(collection(db, ACCOUNT_CATEGORIES_COLLECTION));
      const categoryData = { mediaId, name: categoryTemplate.name, order: categoryTemplate.order, createdAt: new Date(), updatedAt: new Date() };
      batch.set(categoryRef, categoryData);

      for (const itemTemplate of categoryTemplate.items) {
        const itemRef = doc(collection(db, ACCOUNT_ITEMS_COLLECTION));
        const itemData = { mediaId, name: itemTemplate.name, categoryId: categoryRef.id, order: itemTemplate.order, createdAt: new Date(), updatedAt: new Date() };
        batch.set(itemRef, itemData);
      }
    }

    await batch.commit();
    console.log('Default account structure initialized successfully');
  } catch (error) {
    console.error('Error initializing default account structure:', error);
    throw error;
  }
}

export async function migrateAccountItemsToMediaId(): Promise<boolean> {
  const migrationDocRef = doc(db, 'migrations', 'v2-account-items-media-id');
  const migrationDocSnap = await getDoc(migrationDocRef);

  if (migrationDocSnap.exists()) {
    return false; // Migration already done
  }

  console.log('Starting migration v2: Adding mediaId to account items...');

  try {
    // 1. Find the 'all' media document to get its unique ID
    const mediaQuery = query(collection(db, 'medias'), where('slug', '==', 'all'));
    const mediaSnapshot = await getDocs(mediaQuery);
    if (mediaSnapshot.empty) {
      console.warn('Migration v2 skipped: Could not find media with slug "all".');
      // Mark as complete to avoid re-running
      await setDoc(migrationDocRef, { completedAt: new Date(), status: 'skipped' });
      return false;
    }
    const allMediaId = mediaSnapshot.docs[0].id;

    const batch = writeBatch(db);

    // 2. Update all categories without a mediaId
    const catQuery = query(collection(db, ACCOUNT_CATEGORIES_COLLECTION), where('mediaId', '==', null));
    const catSnapshot = await getDocs(catQuery);
    catSnapshot.forEach(doc => {
      batch.update(doc.ref, { mediaId: allMediaId });
    });

    // 3. Update all items without a mediaId
    const itemQuery = query(collection(db, ACCOUNT_ITEMS_COLLECTION), where('mediaId', '==', null));
    const itemSnapshot = await getDocs(itemQuery);
    itemSnapshot.forEach(doc => {
      batch.update(doc.ref, { mediaId: allMediaId });
    });

    await batch.commit();

    // 4. Mark migration as complete
    await setDoc(migrationDocRef, { completedAt: new Date(), status: 'completed' });

    console.log(`Migration v2 completed: ${catSnapshot.size} categories and ${itemSnapshot.size} items updated.`);
    return true;

  } catch (error) {
    console.error('Error during data migration v2:', error);
    throw error;
  }
}

// --- Cleanup Functions ---

// 旧コレクション名（削除対象）
const LEGACY_COLLECTIONS = [
  'budgetItems', // 旧予算項目コレクション
  'accountStructure', // 旧勘定科目構造
  'media_items', // 旧メディア項目
  'account_templates', // 旧テンプレート
  'items', // 旧アイテムコレクション
  'mediaConfigs', // 旧メディア設定（現在は medias を使用）
  'budget_items', // 旧予算項目（アンダースコア形式）
  'account_items', // 旧勘定項目（現在は accountItems を使用）
  'user_settings', // 旧ユーザー設定
  'app_settings' // 旧アプリ設定
];

// 現在使用中のコレクション一覧
const CURRENT_COLLECTIONS = [
  ACCOUNT_CATEGORIES_COLLECTION, // accountCategories
  ACCOUNT_ITEMS_COLLECTION, // accountItems
  'medias', // メディア管理
  'users', // ユーザー管理
];

// 現在のコレクション状況を確認
export async function checkCurrentCollections(): Promise<{
  current: Array<{name: string, count: number}>,
  legacy: Array<{name: string, count: number}>
}> {
  const current: Array<{name: string, count: number}> = [];
  const legacy: Array<{name: string, count: number}> = [];

  // 現在使用中のコレクションをチェック
  for (const collectionName of CURRENT_COLLECTIONS) {
    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      current.push({
        name: collectionName,
        count: querySnapshot.size
      });
    } catch (error) {
      console.log(`Current collection ${collectionName} check failed:`, error);
    }
  }

  // レガシーコレクションをチェック
  for (const collectionName of LEGACY_COLLECTIONS) {
    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        legacy.push({
          name: collectionName,
          count: querySnapshot.size
        });
      }
    } catch (error) {
      console.log(`Legacy collection ${collectionName} does not exist`);
    }
  }

  return { current, legacy };
}

// 旧コレクションの削除（管理者用）
export async function cleanupLegacyCollections(): Promise<void> {
  try {
    const { legacy } = await checkCurrentCollections();

    if (legacy.length === 0) {
      console.log('No legacy collections found to cleanup');
      return;
    }

    console.log(`Found legacy collections to cleanup: ${legacy.map(l => l.name).join(', ')}`);

    const batch = writeBatch(db);
    let batchOperations = 0;

    for (const legacyCollection of legacy) {
      const q = query(collection(db, legacyCollection.name));
      const querySnapshot = await getDocs(q);

      querySnapshot.docs.forEach(docRef => {
        batch.delete(docRef.ref);
        batchOperations++;

        // Firestoreのバッチ操作は500件まで
        if (batchOperations >= 500) {
          throw new Error('Too many documents to delete in single batch. Please run cleanup multiple times.');
        }
      });
    }

    if (batchOperations > 0) {
      await batch.commit();
      console.log(`Cleaned up ${batchOperations} documents from legacy collections`);
    }

  } catch (error) {
    console.error('Error cleaning up legacy collections:', error);
    throw error;
  }
}

// CSVインポート用の関数
export async function createAccountItemsFromCSV(
  mediaId: string,
  newItems: Array<{ categoryName: string; itemName: string }>
): Promise<{ createdCategories: LegacyAccountCategory[]; createdItems: LegacyAccountItem[] }> {
  try {
    const batch = writeBatch(db);
    const createdCategories: LegacyAccountCategory[] = [];
    const createdItems: LegacyAccountItem[] = [];

    // 既存のカテゴリを取得
    const existingCategories = await getAccountCategories(mediaId);
    const categoryMap = new Map(existingCategories.map(cat => [cat.name, cat]));

    // 新しいカテゴリとアイテムをグループ化
    const categoryGroups = new Map<string, string[]>();
    newItems.forEach(({ categoryName, itemName }) => {
      if (!categoryGroups.has(categoryName)) {
        categoryGroups.set(categoryName, []);
      }
      categoryGroups.get(categoryName)!.push(itemName);
    });

    // カテゴリとアイテムを作成
    for (const [categoryName, itemNames] of categoryGroups) {
      let category = categoryMap.get(categoryName);

      // カテゴリが存在しない場合は作成
      if (!category) {
        const categoryRef = doc(collection(db, ACCOUNT_CATEGORIES_COLLECTION));
        const categoryOrder = await getNextCategoryOrder(mediaId);
        const categoryData = {
          mediaId,
          name: categoryName,
          order: categoryOrder,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        batch.set(categoryRef, categoryData);

        category = {
          id: categoryRef.id,
          ...categoryData,
          items: []
        };
        createdCategories.push(category);
        categoryMap.set(categoryName, category);
      }

      // アイテムを作成
      for (const itemName of itemNames) {
        // 既存アイテムとの重複チェック
        const existingItem = category.items.find(item => item.name === itemName);
        if (!existingItem) {
          const itemRef = doc(collection(db, ACCOUNT_ITEMS_COLLECTION));
          const itemOrder = await getNextItemOrder(mediaId, category.id);
          const itemData = {
            mediaId,
            name: itemName,
            categoryId: category.id,
            order: itemOrder,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          batch.set(itemRef, itemData);

          const newItem: LegacyAccountItem = {
            id: itemRef.id,
            ...itemData
          };
          createdItems.push(newItem);
          category.items.push(newItem);
        }
      }
    }

    // バッチでFirestoreに保存
    await batch.commit();
    console.log(`Created ${createdCategories.length} categories and ${createdItems.length} items`);
    return { createdCategories, createdItems };

  } catch (error) {
    console.error('Error creating account items from CSV:', error);
    throw error;
  }
}

// アカウント項目のマッピング提案（類似度チェック）
export async function suggestAccountItemMapping(
  mediaId: string,
  categoryName: string,
  itemName: string
): Promise<FlatAccountItem[]> {
  try {
    const flatItems = await getFlatAccountItems(mediaId);
    const actualItems = flatItems.filter(item => !item.isCategory);

    // 簡単な類似度チェック
    const suggestions = actualItems.filter(item => {
      const nameMatch = item.name.includes(itemName) || itemName.includes(item.name);
      const categoryMatch = item.categoryName.includes(categoryName) || categoryName.includes(item.categoryName);
      return nameMatch || categoryMatch;
    });

    // 類似度順でソート（完全一致 > 部分一致）
    return suggestions.sort((a, b) => {
      const aExactName = a.name === itemName ? 1 : 0;
      const bExactName = b.name === itemName ? 1 : 0;
      const aExactCategory = a.categoryName === categoryName ? 1 : 0;
      const bExactCategory = b.categoryName === categoryName ? 1 : 0;

      return (bExactName + bExactCategory) - (aExactName + aExactCategory);
    });

  } catch (error) {
    console.error('Error suggesting account item mapping:', error);
    return [];
  }
}
