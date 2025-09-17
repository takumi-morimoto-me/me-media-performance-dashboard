import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import {
  AccountCategory,
  AccountItem,
  CreateAccountCategoryInput,
  UpdateAccountCategoryInput,
  CreateAccountItemInput,
  UpdateAccountItemInput,
  FlatAccountItem,
  DEFAULT_ACCOUNT_STRUCTURE
} from '@/types/account-items';

// --- Constants ---
const ACCOUNT_CATEGORIES_COLLECTION = 'accountCategories';
const ACCOUNT_ITEMS_COLLECTION = 'accountItems';

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

// --- Helper Functions ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertCategoryDoc = (doc: any): AccountCategory => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    order: data.order || 0,
    items: [], // itemsは別途取得
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertItemDoc = (doc: any): AccountItem => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    categoryId: data.categoryId,
    order: data.order || 0,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
};

// --- Category Management ---

// カテゴリ一覧を取得
export async function getAccountCategories(): Promise<AccountCategory[]> {
  try {
    const q = query(collection(db, ACCOUNT_CATEGORIES_COLLECTION), orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    const categories = querySnapshot.docs.map(convertCategoryDoc);

    // 各カテゴリの項目を取得
    for (const category of categories) {
      const itemsQ = query(
        collection(db, ACCOUNT_ITEMS_COLLECTION),
        orderBy('order', 'asc')
      );
      const itemsSnapshot = await getDocs(itemsQ);
      category.items = itemsSnapshot.docs
        .map(convertItemDoc)
        .filter(item => item.categoryId === category.id);
    }

    return categories;
  } catch (error) {
    console.error('Error getting account categories:', error);
    throw error;
  }
}

// カテゴリを作成
export async function createAccountCategory(input: CreateAccountCategoryInput): Promise<string> {
  try {
    const now = new Date();
    const order = input.order ?? await getNextCategoryOrder();

    const categoryData = {
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

// カテゴリを更新
export async function updateAccountCategory(categoryId: string, input: UpdateAccountCategoryInput): Promise<void> {
  try {
    const docRef = doc(db, ACCOUNT_CATEGORIES_COLLECTION, categoryId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.order !== undefined) {
      updateData.order = input.order;
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating account category:', error);
    throw error;
  }
}

// カテゴリを削除
export async function deleteAccountCategory(categoryId: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    // カテゴリ内の項目を削除
    const itemsQ = query(collection(db, ACCOUNT_ITEMS_COLLECTION));
    const itemsSnapshot = await getDocs(itemsQ);
    const itemsToDelete = itemsSnapshot.docs.filter(doc => doc.data().categoryId === categoryId);

    itemsToDelete.forEach(itemDoc => {
      batch.delete(itemDoc.ref);
    });

    // カテゴリを削除
    const categoryRef = doc(db, ACCOUNT_CATEGORIES_COLLECTION, categoryId);
    batch.delete(categoryRef);

    await batch.commit();
  } catch (error) {
    console.error('Error deleting account category:', error);
    throw error;
  }
}

// --- Item Management ---

// 項目を作成
export async function createAccountItem(input: CreateAccountItemInput): Promise<string> {
  try {
    const now = new Date();
    const order = input.order ?? await getNextItemOrder(input.categoryId);

    const itemData = {
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

// 項目を更新
export async function updateAccountItem(itemId: string, input: UpdateAccountItemInput): Promise<void> {
  try {
    const docRef = doc(db, ACCOUNT_ITEMS_COLLECTION, itemId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.categoryId !== undefined) {
      updateData.categoryId = input.categoryId;
    }
    if (input.order !== undefined) {
      updateData.order = input.order;
    }

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating account item:', error);
    throw error;
  }
}

// 項目を削除
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

// 次のカテゴリ順序を取得
async function getNextCategoryOrder(): Promise<number> {
  const categories = await getAccountCategories();
  return categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 1;
}

// 次の項目順序を取得
async function getNextItemOrder(categoryId: string): Promise<number> {
  const q = query(collection(db, ACCOUNT_ITEMS_COLLECTION));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs
    .map(convertItemDoc)
    .filter(item => item.categoryId === categoryId);

  return items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 1;
}

// スプレッドシート表示用の扁平化されたリストを取得
export async function getFlatAccountItems(): Promise<FlatAccountItem[]> {
  const categories = await getAccountCategories();
  const flatItems: FlatAccountItem[] = [];

  categories.forEach(category => {
    // カテゴリヘッダーを追加
    flatItems.push({
      id: `category-${category.id}`,
      name: category.name,
      categoryId: category.id,
      categoryName: category.name,
      fullName: category.name,
      isCategory: true,
      order: category.order * 1000 // カテゴリを最上位にするため大きな数値
    });

    // カテゴリ内の項目を追加
    category.items.forEach(item => {
      flatItems.push({
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        categoryName: category.name,
        fullName: `${category.name} > ${item.name}`,
        isCategory: false,
        order: category.order * 1000 + item.order
      });
    });
  });

  return flatItems.sort((a, b) => a.order - b.order);
}

// CSVインポート時の新項目自動作成
export async function createAccountItemsFromCSV(
  newItems: Array<{ categoryName: string; itemName: string }>
): Promise<{ createdCategories: AccountCategory[]; createdItems: AccountItem[] }> {
  try {
    const batch = writeBatch(db);
    const createdCategories: AccountCategory[] = [];
    const createdItems: AccountItem[] = [];

    // 既存のカテゴリを取得
    const existingCategories = await getAccountCategories();
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
        const categoryOrder = await getNextCategoryOrder();

        const categoryData = {
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
          const itemOrder = await getNextItemOrder(category.id);

          const itemData = {
            name: itemName,
            categoryId: category.id,
            order: itemOrder,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          batch.set(itemRef, itemData);

          const newItem: AccountItem = {
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

// 項目名の自動提案（既存項目との類似性チェック）
export async function suggestAccountItemMapping(
  csvCategoryName: string,
  csvItemName: string
): Promise<FlatAccountItem[]> {
  try {
    const flatItems = await getFlatAccountItems();
    const actualItems = flatItems.filter(item => !item.isCategory);

    // 類似度スコア計算
    const suggestions = actualItems.map(item => {
      let score = 0;

      // カテゴリ名の類似度
      if (item.categoryName.includes(csvCategoryName) || csvCategoryName.includes(item.categoryName)) {
        score += 3;
      }
      if (item.categoryName.toLowerCase() === csvCategoryName.toLowerCase()) {
        score += 5;
      }

      // アイテム名の類似度
      if (item.name.includes(csvItemName) || csvItemName.includes(item.name)) {
        score += 2;
      }
      if (item.name.toLowerCase() === csvItemName.toLowerCase()) {
        score += 10;
      }

      // 部分一致の計算
      const categoryWords = csvCategoryName.split(/[\s　]/);
      const itemWords = csvItemName.split(/[\s　]/);

      categoryWords.forEach(word => {
        if (word && item.categoryName.includes(word)) score += 1;
      });

      itemWords.forEach(word => {
        if (word && item.name.includes(word)) score += 1;
      });

      return { item, score };
    });

    // スコア順でソートし、上位5件を返す
    return suggestions
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.item);

  } catch (error) {
    console.error('Error suggesting account item mapping:', error);
    return [];
  }
}

// デフォルトの勘定項目構造を初期化
export async function initializeDefaultAccountStructure(): Promise<void> {
  try {
    // 既存のデータがあるかチェック
    const existingCategories = await getAccountCategories();
    if (existingCategories.length > 0) {
      console.log('Account structure already initialized');
      return;
    }

    console.log('Initializing default account structure...');
    const batch = writeBatch(db);

    // カテゴリを作成
    for (const categoryTemplate of DEFAULT_ACCOUNT_STRUCTURE) {
      const categoryRef = doc(collection(db, ACCOUNT_CATEGORIES_COLLECTION));
      const categoryData = {
        name: categoryTemplate.name,
        order: categoryTemplate.order,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      batch.set(categoryRef, categoryData);

      // カテゴリ内の項目を作成
      for (const itemTemplate of categoryTemplate.items) {
        const itemRef = doc(collection(db, ACCOUNT_ITEMS_COLLECTION));
        const itemData = {
          name: itemTemplate.name,
          categoryId: categoryRef.id,
          order: itemTemplate.order,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
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

// --- Cleanup Functions ---

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

// 旧コレクションの存在確認（後方互換性のため残す）
export async function checkLegacyCollections(): Promise<string[]> {
  const existingCollections: string[] = [];

  for (const collectionName of LEGACY_COLLECTIONS) {
    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        existingCollections.push(collectionName);
      }
    } catch (error) {
      // コレクションが存在しない場合はエラーが発生する可能性がある
      console.log(`Collection ${collectionName} does not exist or is empty`);
    }
  }

  return existingCollections;
}

// 旧コレクションの削除（管理者用）
export async function cleanupLegacyCollections(): Promise<void> {
  try {
    const existingCollections = await checkLegacyCollections();

    if (existingCollections.length === 0) {
      console.log('No legacy collections found to cleanup');
      return;
    }

    console.log(`Found legacy collections to cleanup: ${existingCollections.join(', ')}`);

    const batch = writeBatch(db);
    let batchOperations = 0;

    for (const collectionName of existingCollections) {
      const q = query(collection(db, collectionName));
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