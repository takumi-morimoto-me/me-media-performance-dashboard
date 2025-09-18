import { db } from './firebase';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  query,
  limit
} from 'firebase/firestore';

// クリーンアップ対象のコレクション
const COLLECTIONS_TO_CLEAN = [
  'accountCategories',    // 旧構造
  'accountItems',         // 旧構造
  'accounts',            // 新構造
  'budgets',             // 予算データ
  'results',             // 実績データ（もしあれば）
  'migrations'           // 移行記録
];

// 削除対象外のコレクション（保持したいデータ）
const COLLECTIONS_TO_KEEP = [
  'medias'  // メディア情報は保持
];

interface CleanupResult {
  collectionName: string;
  deletedCount: number;
  error?: string;
}

export async function cleanupAllFirebaseData(): Promise<CleanupResult[]> {
  console.log('🧹 Starting Firebase data cleanup...');
  const results: CleanupResult[] = [];

  for (const collectionName of COLLECTIONS_TO_CLEAN) {
    try {
      console.log(`\n📂 Cleaning collection: ${collectionName}`);
      const deletedCount = await cleanupCollection(collectionName);

      results.push({
        collectionName,
        deletedCount
      });

      console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error cleaning ${collectionName}:`, error);
      results.push({
        collectionName,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // サマリーを表示
  console.log('\n📊 Cleanup Summary:');
  console.log('='.repeat(50));

  let totalDeleted = 0;
  results.forEach(result => {
    const status = result.error ? '❌ ERROR' : '✅ SUCCESS';
    console.log(`${status} ${result.collectionName}: ${result.deletedCount} documents`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    totalDeleted += result.deletedCount;
  });

  console.log('='.repeat(50));
  console.log(`🎯 Total documents deleted: ${totalDeleted}`);
  console.log('\n🔄 Preserved collections:', COLLECTIONS_TO_KEEP);

  return results;
}

async function cleanupCollection(collectionName: string): Promise<number> {
  const collectionRef = collection(db, collectionName);
  let deletedCount = 0;
  let hasMoreDocs = true;

  while (hasMoreDocs) {
    // バッチサイズを制限して安全に削除
    const snapshot = await getDocs(query(collectionRef, limit(500)));

    if (snapshot.empty) {
      hasMoreDocs = false;
      break;
    }

    // バッチ削除を使用
    const batch = writeBatch(db);

    snapshot.docs.forEach(docSnapshot => {
      batch.delete(docSnapshot.ref);
    });

    await batch.commit();
    deletedCount += snapshot.docs.length;

    console.log(`   Deleted batch: ${snapshot.docs.length} documents (total: ${deletedCount})`);

    // 大量削除時のレート制限回避
    if (snapshot.docs.length >= 500) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
    }
  }

  return deletedCount;
}

// サブコレクションをクリーンアップ（medias/{id}/budgets など）
export async function cleanupSubcollections(): Promise<void> {
  console.log('\n🗂️ Cleaning up subcollections...');

  try {
    // medias コレクション内のサブコレクションをクリーンアップ
    const mediasSnapshot = await getDocs(collection(db, 'medias'));

    for (const mediaDoc of mediasSnapshot.docs) {
      const mediaId = mediaDoc.id;

      // budgets サブコレクション
      try {
        const budgetsRef = collection(db, 'medias', mediaId, 'budgets');
        const budgetsSnapshot = await getDocs(budgetsRef);

        for (const budgetDoc of budgetsSnapshot.docs) {
          await deleteDoc(budgetDoc.ref);
        }

        console.log(`   Cleaned budgets for media: ${mediaId} (${budgetsSnapshot.docs.length} docs)`);
      } catch (error) {
        console.log(`   No budgets subcollection for media: ${mediaId}`);
      }

      // results サブコレクション（もしあれば）
      try {
        const resultsRef = collection(db, 'medias', mediaId, 'results');
        const resultsSnapshot = await getDocs(resultsRef);

        for (const resultDoc of resultsSnapshot.docs) {
          await deleteDoc(resultDoc.ref);
        }

        console.log(`   Cleaned results for media: ${mediaId} (${resultsSnapshot.docs.length} docs)`);
      } catch (error) {
        console.log(`   No results subcollection for media: ${mediaId}`);
      }
    }
  } catch (error) {
    console.error('❌ Error cleaning subcollections:', error);
  }
}

// 完全クリーンアップ（サブコレクション含む）
export async function performCompleteCleanup(): Promise<void> {
  console.log('🚀 Starting COMPLETE Firebase cleanup...');
  console.log('⚠️  This will delete ALL data except medias collection');
  console.log('📝 Collections to keep:', COLLECTIONS_TO_KEEP);
  console.log('🗑️  Collections to delete:', COLLECTIONS_TO_CLEAN);

  try {
    // メインコレクションをクリーンアップ
    await cleanupAllFirebaseData();

    // サブコレクションもクリーンアップ
    await cleanupSubcollections();

    console.log('\n🎉 Complete cleanup finished!');
    console.log('✨ Firebase is now clean and ready for the new structure');

  } catch (error) {
    console.error('💥 Cleanup failed:', error);
    throw error;
  }
}

// 開発用：特定のコレクションのみクリーンアップ
export async function cleanupSpecificCollections(collectionNames: string[]): Promise<CleanupResult[]> {
  console.log('🎯 Cleaning specific collections:', collectionNames);
  const results: CleanupResult[] = [];

  for (const collectionName of collectionNames) {
    try {
      const deletedCount = await cleanupCollection(collectionName);
      results.push({
        collectionName,
        deletedCount
      });
      console.log(`✅ ${collectionName}: ${deletedCount} documents deleted`);
    } catch (error) {
      console.error(`❌ ${collectionName}:`, error);
      results.push({
        collectionName,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}