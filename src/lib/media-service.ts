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
  orderBy
} from 'firebase/firestore';

export interface MediaConfig {
  id: string;
  name: string;
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

const MEDIAS_COLLECTION = 'medias';
const DEFAULT_ACCOUNT_ITEMS = ['広告費', '制作費', '人件費'];

// メディア一覧を取得
export async function getMedias(): Promise<MediaConfig[]> {
  try {
    const q = query(collection(db, MEDIAS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    } as MediaConfig));
  } catch (error) {
    console.error('Error getting medias:', error);
    throw error;
  }
}

// 特定のメディアを取得
export async function getMedia(mediaId: string): Promise<MediaConfig | null> {
  try {
    const docRef = doc(db, MEDIAS_COLLECTION, mediaId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
      updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
    } as MediaConfig;
  } catch (error) {
    console.error('Error getting media:', error);
    throw error;
  }
}

// メディアを作成
export async function createMedia(input: CreateMediaInput): Promise<string> {
  try {
    const now = new Date();
    const mediaData = {
      name: input.name,
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
    const updateData: Record<string, unknown> = {
      ...input,
      updatedAt: new Date(),
    };
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating media:', error);
    throw error;
  }
}

// メディアを削除
export async function deleteMedia(mediaId: string): Promise<void> {
  try {
    const docRef = doc(db, MEDIAS_COLLECTION, mediaId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting media:', error);
    throw error;
  }
}

// メディアに勘定項目を追加
export async function addAccountItem(mediaId: string, accountItem: string): Promise<void> {
  try {
    const media = await getMedia(mediaId);
    if (!media) {
      throw new Error('Media not found');
    }
    
    if (media.accountItems.includes(accountItem)) {
      throw new Error('Account item already exists');
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

// 既存のメディア選択肢にマッチするメディア設定を初期化
export async function initializeExistingMedias(): Promise<void> {
  try {
    // 既存のメディア選択肢
    const existingMedias = [
      { id: 'all', name: '全体', accountItems: ['広告費', '制作費', '人件費', '管理費'] },
      { id: 'beginners', name: 'ビギナーズ', accountItems: ['広告費', '制作費', '人件費', 'LP制作費'] },
      { id: 'cheapest-repair', name: '最安修理', accountItems: ['広告費', '制作費', '人件費', 'SEO対策費'] },
      { id: 'mortorz', name: 'Mortorz', accountItems: ['広告費', '制作費', '人件費', 'システム開発費'] },
    ];
    
    for (const media of existingMedias) {
      const existingMedia = await getMedia(media.id);
      if (!existingMedia) {
        // IDを指定してメディア設定を作成
        const now = new Date();
        const mediaData = {
          name: media.name,
          accountItems: media.accountItems,
          createdAt: now,
          updatedAt: now,
        };
        
        const docRef = doc(db, MEDIAS_COLLECTION, media.id);
        await setDoc(docRef, mediaData);
      }
    }
  } catch (error) {
    console.error('Error initializing existing medias:', error);
    throw error;
  }
}

// 既存のメディアIDかチェック
export function isValidMediaId(mediaId: string): boolean {
  const validIds = ['all', 'beginners', 'cheapest-repair', 'mortorz'];
  return validIds.includes(mediaId);
}