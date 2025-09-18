// 新しい統合勘定項目構造定義

export interface AccountItem {
  id: string;
  name: string;
  category: string; // カテゴリ名
  mediaIds: string[]; // 使用しているメディアID配列
  order: number; // 表示順序
  type: 'category' | 'item'; // カテゴリか項目かの区別
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountItemInput {
  name: string;
  category: string;
  mediaIds: string[];
  order?: number;
  type: 'category' | 'item';
}

export interface UpdateAccountItemInput {
  name?: string;
  category?: string;
  mediaIds?: string[];
  order?: number;
  type?: 'category' | 'item';
}

// 後方互換性のための旧型定義（移行期間中に使用）
export interface LegacyAccountItem {
  id: string;
  mediaId: string;
  name: string;
  categoryId: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegacyAccountCategory {
  id: string;
  mediaId: string;
  name: string;
  order: number;
  items: LegacyAccountItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountCategoryInput {
  name: string;
  order?: number;
}

export interface UpdateAccountCategoryInput {
  name?: string;
  order?: number;
}

// Legacy input types for backward compatibility
export interface LegacyCreateAccountItemInput {
  name: string;
  categoryId: string;
  order?: number;
}

export interface LegacyUpdateAccountItemInput {
  name?: string;
  categoryId?: string;
  order?: number;
}

// スプレッドシート表示用の扁平化された構造
export interface FlatAccountItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  fullName: string; // "大項目名 > 小項目名"
  isCategory: boolean; // 大項目ヘッダーかどうか
  order: number;
}

// デフォルトの勘定項目テンプレート
export const DEFAULT_ACCOUNT_STRUCTURE: Omit<LegacyAccountCategory, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '広告費',
    mediaId: '', // Will be set when used
    order: 1,
    items: [
      { id: 'temp-1', name: 'Google広告', mediaId: '', categoryId: 'temp-cat-1', order: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-2', name: 'Facebook広告', mediaId: '', categoryId: 'temp-cat-1', order: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-3', name: 'YouTube広告', mediaId: '', categoryId: 'temp-cat-1', order: 3, createdAt: new Date(), updatedAt: new Date() },
    ]
  },
  {
    name: '制作費',
    mediaId: '', // Will be set when used
    order: 2,
    items: [
      { id: 'temp-4', name: '動画制作', mediaId: '', categoryId: 'temp-cat-2', order: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-5', name: '画像制作', mediaId: '', categoryId: 'temp-cat-2', order: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-6', name: 'コピー作成', mediaId: '', categoryId: 'temp-cat-2', order: 3, createdAt: new Date(), updatedAt: new Date() },
    ]
  },
  {
    name: '人件費',
    mediaId: '', // Will be set when used
    order: 3,
    items: [
      { id: 'temp-7', name: '運用担当', mediaId: '', categoryId: 'temp-cat-3', order: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-8', name: 'ディレクター', mediaId: '', categoryId: 'temp-cat-3', order: 2, createdAt: new Date(), updatedAt: new Date() },
    ]
  }
];