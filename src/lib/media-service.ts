
import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc,
  deleteDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
// @ts-expect-error - No type definitions available for kuroshiro
import Kuroshiro from 'kuroshiro';
// @ts-expect-error - No type definitions available for kuroshiro-analyzer-kuromoji
import KuromojiAnalyzer from 'kuroshiro-analyzer-kuromoji';

// --- Interfaces ---
export interface MediaConfig {
  id: string;
  name: string;
  slug: string;
  accountItems: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMediaInput {
  name: string;
  accountItems?: string[];
}

export interface UpdateMediaInput {
  name?: string;
  accountItems?: string[];
}

// --- Constants ---
const MEDIAS_COLLECTION = 'medias';
const DEFAULT_ACCOUNT_ITEMS = ['広告費', '制作費', '人件費'];

// --- Kuroshiro Singleton --- 
let kuroshiro: Kuroshiro | null = null;
let kuroshiroPromise: Promise<void> | null = null;

async function getKuroshiroInstance() {
  if (!kuroshiro) {
    if (!kuroshiroPromise) {
      kuroshiroPromise = (async () => {
        const instance = new Kuroshiro();
        await instance.init(new KuromojiAnalyzer({ dictPath: '/dict' }));
        kuroshiro = instance;
      })();
    }
    await kuroshiroPromise;
  }
  return kuroshiro!;
}

// --- Slug Generation ---
async function createSlug(name: string): Promise<string> {
  const kuroshiro = await getKuroshiroInstance();
  const romaji = await kuroshiro.convert(name, { to: 'romaji', romajiSystem: 'passport' });
  
  const slug = romaji
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-'); // collapse dashes

  return slug;
}

async function generateUniqueSlug(name: string, currentId?: string): Promise<string> {
  let slug = await createSlug(name);
  let isUnique = false;
  let counter = 1;

  while (!isUnique) {
    const q = query(collection(db, MEDIAS_COLLECTION), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty || (querySnapshot.docs.length === 1 && querySnapshot.docs[0].id === currentId)) {
      isUnique = true;
    } else {
      slug = `${await createSlug(name)}-${counter}`;
      counter++;
    }
  }
  return slug;
}

// --- Firestore Helper --- 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convertDocToMedia = (doc: any): MediaConfig => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    slug: data.slug,
    accountItems: data.accountItems || [],
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
  };
}

// --- Public API ---

// メディア一覧を取得
export async function getMedias(): Promise<MediaConfig[]> {
  try {
    const q = query(collection(db, MEDIAS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertDocToMedia);
  } catch (error) {
    console.error('Error getting medias:', error);
    throw error;
  }
}

// IDで特定のメディアを取得
export async function getMedia(mediaId: string): Promise<MediaConfig | null> {
  try {
    const docRef = doc(db, MEDIAS_COLLECTION, mediaId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertDocToMedia(docSnap) : null;
  } catch (error) {
    console.error('Error getting media:', error);
    throw error;
  }
}

// Slugで特定のメディアを取得
export async function getMediaBySlug(slug: string): Promise<MediaConfig | null> {
  try {
    const q = query(collection(db, MEDIAS_COLLECTION), where("slug", "==", slug));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }
    return convertDocToMedia(querySnapshot.docs[0]);
  } catch (error) {
    console.error('Error getting media by slug:', error);
    throw error;
  }
}

// メディアを作成
export async function createMedia(input: CreateMediaInput): Promise<string> {
  try {
    const slug = await generateUniqueSlug(input.name);
    const now = new Date();
    
    const mediaData = {
      name: input.name,
      slug: slug,
      accountItems: input.accountItems || DEFAULT_ACCOUNT_ITEMS,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(collection(db, MEDIAS_COLLECTION), mediaData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating media:', error);
    throw error;
  }
}

// メディアを更新
export async function updateMedia(mediaId: string, input: UpdateMediaInput): Promise<void> {
  try {
    const docRef = doc(db, MEDIAS_COLLECTION, mediaId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name) {
      updateData.name = input.name;
      updateData.slug = await generateUniqueSlug(input.name, mediaId);
    }
    if (input.accountItems) {
      updateData.accountItems = input.accountItems;
    }
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating media:', error);
    throw error;
  }
}

// メディアを削除
export async function deleteMedia(mediaId: string): Promise<void> {
  try {
    // TODO: Delete sub-collections (budgets, results) as well.
    // This should be handled by a Firebase Cloud Function for robustness.
    const docRef = doc(db, MEDIAS_COLLECTION, mediaId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
}

// --- Account Item Functions (No change needed for these) ---

// メディアに勘定項目を追加
export async function addAccountItem(mediaId: string, accountItem: string): Promise<void> {
  try {
    const media = await getMedia(mediaId);
    if (!media) {
      throw new Error('Media not found');
    }
    if (media.accountItems.includes(accountItem)) {
      return; // Already exists
    }
    const updatedAccountItems = [...media.accountItems, accountItem];
    await updateMedia(mediaId, { accountItems: updatedAccountItems });
  } catch (error) {
    console.error('Error adding account item:', error);
    throw error;
  }
}

// メディアから勘定項目を削除
export async function removeAccountItem(mediaId: string, accountItem: string): Promise<void> {
  try {
    const media = await getMedia(mediaId);
    if (!media) {
      throw new Error('Media not found');
    }
    const updatedAccountItems = media.accountItems.filter(item => item !== accountItem);
    await updateMedia(mediaId, { accountItems: updatedAccountItems });
  } catch (error) {
    console.error('Error removing account item:', error);
    throw error;
  }
}

// 勘定項目名を変更
export async function renameAccountItem(
  mediaId: string, 
  oldName: string, 
  newName: string
): Promise<void> {
  try {
    const media = await getMedia(mediaId);
    if (!media) {
      throw new Error('Media not found');
    }
    const updatedAccountItems = media.accountItems.map(item => 
      item === oldName ? newName : item
    );
    await updateMedia(mediaId, { accountItems: updatedAccountItems });
  } catch (error) {
    console.error('Error renaming account item:', error);
    throw error;
  }
}

// --- Data Migration ---
export async function migrateDataStructure(): Promise<boolean> {
  const migrationDocRef = doc(db, 'migrations', 'v1-slug-unique-id');
  const migrationDocSnap = await getDoc(migrationDocRef);

  if (migrationDocSnap.exists()) {
    console.log('Migration v1 has already been completed.');
    return false;
  }

  console.log('Starting data migration v1...');

  try {
    const batch = writeBatch(db);

    // Get all old medias and budgets
    const oldMediasQuery = query(collection(db, 'medias'), where('slug', '==', null));
    const oldMediasSnap = await getDocs(oldMediasQuery);
    const oldBudgetsSnap = await getDocs(collection(db, 'budgets'));

    if (oldMediasSnap.empty) {
      console.log('No old media documents to migrate.');
      await setDoc(migrationDocRef, { completedAt: new Date() });
      return false;
    }

    const idMap = new Map<string, string>();

    // Create new media docs and prepare for deletion
    for (const oldDoc of oldMediasSnap.docs) {
      const oldData = oldDoc.data();
      const newSlug = await generateUniqueSlug(oldData.name);
      
      const newMediaRef = doc(collection(db, MEDIAS_COLLECTION));
      const newMediaData = {
        name: oldData.name,
        slug: newSlug,
        accountItems: oldData.accountItems || DEFAULT_ACCOUNT_ITEMS,
        createdAt: oldData.createdAt || new Date(),
        updatedAt: new Date(),
      };
      batch.set(newMediaRef, newMediaData);
      idMap.set(oldDoc.id, newMediaRef.id);
      batch.delete(oldDoc.ref);
    }

    // Move budgets to sub-collections
    for (const budgetDoc of oldBudgetsSnap.docs) {
      const [oldMediaId, year] = budgetDoc.id.split('_');
      if (!oldMediaId || !year) continue;

      const newMediaId = idMap.get(oldMediaId);
      if (newMediaId) {
        const newBudgetRef = doc(db, MEDIAS_COLLECTION, newMediaId, 'budgets', year);
        batch.set(newBudgetRef, budgetDoc.data());
        batch.delete(budgetDoc.ref);
      }
    }

    await batch.commit();

    // Mark migration as complete
    await setDoc(migrationDocRef, { completedAt: new Date() });

    console.log('Data migration v1 completed successfully!');
    return true;

  } catch (error) {
    console.error('Error during data migration:', error);
    throw error;
  }
}