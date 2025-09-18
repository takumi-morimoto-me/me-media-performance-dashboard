import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  writeBatch,
  Timestamp,
  DocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import {
  AccountItem,
  CreateAccountItemInput,
  UpdateAccountItemInput,
  FlatAccountItem
} from '@/types/account-items';

// --- Constants ---
const ACCOUNTS_COLLECTION = 'accounts';

// --- Helper Functions ---
const convertDocToAccountItem = (doc: DocumentSnapshot<DocumentData>): AccountItem => {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }
  return {
    id: doc.id,
    name: data.name,
    category: data.category,
    mediaIds: data.mediaIds || [],
    order: data.order || 0,
    type: data.type,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
};

// --- CRUD Operations ---

export async function getAccountItems(mediaId: string): Promise<AccountItem[]> {
  try {
    // インデックス作成前の一時的な回避策：orderByを除去してクライアントサイドでソート
    const q = query(
      collection(db, ACCOUNTS_COLLECTION),
      where('mediaIds', 'array-contains', mediaId)
    );
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(convertDocToAccountItem);

    // クライアントサイドでソート
    return items.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('Error getting account items:', error);
    throw error;
  }
}

export async function getAccountItem(itemId: string): Promise<AccountItem | null> {
  try {
    const docRef = doc(db, ACCOUNTS_COLLECTION, itemId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertDocToAccountItem(docSnap) : null;
  } catch (error) {
    console.error('Error getting account item:', error);
    throw error;
  }
}

export async function createAccountItem(input: CreateAccountItemInput): Promise<string> {
  try {
    const now = new Date();
    const itemData = {
      name: input.name,
      category: input.category,
      mediaIds: input.mediaIds,
      order: input.order || 0,
      type: input.type,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, ACCOUNTS_COLLECTION), itemData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating account item:', error);
    throw error;
  }
}

export async function updateAccountItem(itemId: string, input: UpdateAccountItemInput): Promise<void> {
  try {
    const docRef = doc(db, ACCOUNTS_COLLECTION, itemId);
    const updateData: Record<string, string | number | Date | string[]> = { updatedAt: new Date() };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.mediaIds !== undefined) updateData.mediaIds = input.mediaIds;
    if (input.order !== undefined) updateData.order = input.order;
    if (input.type !== undefined) updateData.type = input.type;

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating account item:', error);
    throw error;
  }
}

export async function deleteAccountItem(itemId: string): Promise<void> {
  try {
    // アイテム情報を取得してからクリーンアップ
    const item = await getAccountItem(itemId);
    if (!item) {
      throw new Error('Account item not found');
    }

    // アイテムを削除
    const docRef = doc(db, ACCOUNTS_COLLECTION, itemId);
    await deleteDoc(docRef);

    // 関連する予算データをクリーンアップ
    await cleanupBudgetDataForDeletedItem(itemId, item.mediaIds);
  } catch (error) {
    console.error('Error deleting account item:', error);
    throw error;
  }
}

// 削除されたアイテムの予算データをクリーンアップ
async function cleanupBudgetDataForDeletedItem(itemId: string, mediaIds: string[]): Promise<void> {
  try {
    console.log(`Cleaning up budget data for deleted item ${itemId}`);

    // 各メディアの予算データから該当項目を削除
    for (const mediaId of mediaIds) {
      await cleanupBudgetDataForMedia(mediaId, itemId);
    }
  } catch (error) {
    console.error('Error cleaning up budget data:', error);
    // エラーが発生してもアイテム削除は成功とする（データクリーンアップは補助的）
  }
}

// 特定メディアの予算データから指定項目を削除
async function cleanupBudgetDataForMedia(mediaId: string, itemId: string): Promise<void> {
  try {
    // 全年度の予算データを確認してクリーンアップ
    const currentYear = new Date().getFullYear();
    const yearsToCheck = [currentYear - 1, currentYear, currentYear + 1]; // 前年、今年、来年

    for (const year of yearsToCheck) {
      const budgetDocRef = doc(db, 'budgets', `${mediaId}-${year}`);
      const budgetDoc = await getDoc(budgetDocRef);

      if (budgetDoc.exists()) {
        const budgetData = budgetDoc.data();

        // 該当項目のデータが存在する場合は削除
        if (budgetData && budgetData[itemId]) {
          const updatedData = { ...budgetData };
          delete updatedData[itemId];

          await setDoc(budgetDocRef, updatedData);
          console.log(`Cleaned up budget data for ${mediaId}-${year}, removed item ${itemId}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error cleaning up budget data for ${mediaId}:`, error);
  }
}

// --- Utility Functions ---

export async function getFlatAccountItems(mediaId: string): Promise<FlatAccountItem[]> {
  const items = await getAccountItems(mediaId);
  const flatItems: FlatAccountItem[] = [];

  // カテゴリごとにグループ化
  const categories = new Set(items.filter(item => item.type === 'category').map(item => item.category));
  const regularItems = items.filter(item => item.type === 'item');

  categories.forEach(categoryName => {
    // カテゴリヘッダーを追加
    const categoryItem = items.find(item => item.type === 'category' && item.category === categoryName);
    if (categoryItem) {
      flatItems.push({
        id: `category-${categoryItem.id}`,
        name: categoryItem.name,
        categoryId: categoryItem.id,
        categoryName: categoryItem.name,
        fullName: categoryItem.name,
        isCategory: true,
        order: categoryItem.order * 1000
      });
    }

    // そのカテゴリの項目を追加
    const categoryItems = regularItems.filter(item => item.category === categoryName);
    categoryItems.forEach(item => {
      flatItems.push({
        id: item.id,
        name: item.name,
        categoryId: categoryItem?.id || '',
        categoryName: categoryName,
        fullName: `${categoryName} > ${item.name}`,
        isCategory: false,
        order: (categoryItem?.order || 0) * 1000 + item.order
      });
    });
  });

  return flatItems.sort((a, b) => a.order - b.order);
}

export async function addMediaToAccountItem(itemId: string, mediaId: string): Promise<void> {
  try {
    const item = await getAccountItem(itemId);
    if (!item) {
      throw new Error('Account item not found');
    }

    if (!item.mediaIds.includes(mediaId)) {
      const updatedMediaIds = [...item.mediaIds, mediaId];
      await updateAccountItem(itemId, { mediaIds: updatedMediaIds });
    }
  } catch (error) {
    console.error('Error adding media to account item:', error);
    throw error;
  }
}

export async function removeMediaFromAccountItem(itemId: string, mediaId: string): Promise<void> {
  try {
    const item = await getAccountItem(itemId);
    if (!item) {
      throw new Error('Account item not found');
    }

    const updatedMediaIds = item.mediaIds.filter(id => id !== mediaId);
    await updateAccountItem(itemId, { mediaIds: updatedMediaIds });
  } catch (error) {
    console.error('Error removing media from account item:', error);
    throw error;
  }
}

// --- Default Structure ---
export const DEFAULT_ACCOUNT_ITEMS: Omit<CreateAccountItemInput, 'mediaIds'>[] = [
  // カテゴリ
  { name: '広告費', category: '広告費', order: 1, type: 'category' },
  { name: '制作費', category: '制作費', order: 2, type: 'category' },
  { name: '人件費', category: '人件費', order: 3, type: 'category' },

  // 広告費の項目
  { name: 'Google広告', category: '広告費', order: 1, type: 'item' },
  { name: 'Facebook広告', category: '広告費', order: 2, type: 'item' },
  { name: 'YouTube広告', category: '広告費', order: 3, type: 'item' },

  // 制作費の項目
  { name: '動画制作', category: '制作費', order: 1, type: 'item' },
  { name: '画像制作', category: '制作費', order: 2, type: 'item' },
  { name: 'コピー作成', category: '制作費', order: 3, type: 'item' },

  // 人件費の項目
  { name: '運用担当', category: '人件費', order: 1, type: 'item' },
  { name: 'ディレクター', category: '人件費', order: 2, type: 'item' },
];

export async function initializeDefaultAccountItems(mediaId: string): Promise<void> {
  try {
    const existingItems = await getAccountItems(mediaId);
    if (existingItems.length > 0) {
      console.log(`Account items for media ${mediaId} already initialized`);
      return;
    }

    const batch = writeBatch(db);
    const now = new Date();

    DEFAULT_ACCOUNT_ITEMS.forEach(item => {
      const docRef = doc(collection(db, ACCOUNTS_COLLECTION));
      batch.set(docRef, {
        ...item,
        mediaIds: [mediaId],
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
    console.log(`Initialized default account items for media ${mediaId}`);
  } catch (error) {
    console.error('Error initializing default account items:', error);
    throw error;
  }
}

// --- Migration Functions ---

export async function migrateFromLegacyStructure(): Promise<void> {
  try {
    console.log('Starting migration from legacy account structure...');

    // 旧構造のインポート
    const { getAccountCategories } = await import('./account-service');
    const { getMedias } = await import('./media-service');

    // 全メディアを取得
    const medias = await getMedias();
    console.log(`Found ${medias.length} medias to migrate`);

    const batch = writeBatch(db);
    const now = new Date();
    let migratedCount = 0;

    for (const media of medias) {
      try {
        // 旧構造からカテゴリとアイテムを取得
        const legacyCategories = await getAccountCategories(media.id);
        console.log(`Migrating ${legacyCategories.length} categories for media ${media.name}`);

        for (const category of legacyCategories) {
          // カテゴリを新構造で作成
          const categoryDocRef = doc(collection(db, ACCOUNTS_COLLECTION));
          batch.set(categoryDocRef, {
            name: category.name,
            category: category.name,
            mediaIds: [media.id],
            order: category.order,
            type: 'category',
            createdAt: category.createdAt,
            updatedAt: now,
          });
          migratedCount++;

          // そのカテゴリの項目を移行
          for (const item of category.items) {
            const itemDocRef = doc(collection(db, ACCOUNTS_COLLECTION));
            batch.set(itemDocRef, {
              name: item.name,
              category: category.name,
              mediaIds: [media.id],
              order: item.order,
              type: 'item',
              createdAt: item.createdAt,
              updatedAt: now,
            });
            migratedCount++;
          }
        }
      } catch (error) {
        console.error(`Error migrating media ${media.name}:`, error);
        // 個別メディアのエラーは無視して続行
      }
    }

    // バッチコミット
    await batch.commit();
    console.log(`Migration completed! Migrated ${migratedCount} items.`);

    // 移行完了フラグを設定
    const migrationDocRef = doc(db, 'migrations', 'accounts-structure-v2');
    await updateDoc(migrationDocRef, {
      completed: true,
      completedAt: now,
      migratedCount
    }).catch(async () => {
      // ドキュメントが存在しない場合は作成
      await addDoc(collection(db, 'migrations'), {
        id: 'accounts-structure-v2',
        completed: true,
        completedAt: now,
        migratedCount
      });
    });

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

export async function checkMigrationStatus(): Promise<boolean> {
  try {
    const migrationDocRef = doc(db, 'migrations', 'accounts-structure-v2');
    const migrationDoc = await getDoc(migrationDocRef);
    return migrationDoc.exists() && migrationDoc.data()?.completed === true;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}