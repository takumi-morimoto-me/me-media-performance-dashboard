// 勘定項目の階層構造定義

export interface AccountItem {
  id: string;
  name: string;
  categoryId: string;
  order: number; // 表示順序
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountCategory {
  id: string;
  name: string;
  order: number; // 表示順序
  items: AccountItem[];
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

export interface CreateAccountItemInput {
  name: string;
  categoryId: string;
  order?: number;
}

export interface UpdateAccountItemInput {
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
export const DEFAULT_ACCOUNT_STRUCTURE: Omit<AccountCategory, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '広告費',
    order: 1,
    items: [
      { id: 'temp-1', name: 'Google広告', categoryId: 'temp-cat-1', order: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-2', name: 'Facebook広告', categoryId: 'temp-cat-1', order: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-3', name: 'YouTube広告', categoryId: 'temp-cat-1', order: 3, createdAt: new Date(), updatedAt: new Date() },
    ]
  },
  {
    name: '制作費',
    order: 2,
    items: [
      { id: 'temp-4', name: '動画制作', categoryId: 'temp-cat-2', order: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-5', name: '画像制作', categoryId: 'temp-cat-2', order: 2, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-6', name: 'コピー作成', categoryId: 'temp-cat-2', order: 3, createdAt: new Date(), updatedAt: new Date() },
    ]
  },
  {
    name: '人件費',
    order: 3,
    items: [
      { id: 'temp-7', name: '運用担当', categoryId: 'temp-cat-3', order: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'temp-8', name: 'ディレクター', categoryId: 'temp-cat-3', order: 2, createdAt: new Date(), updatedAt: new Date() },
    ]
  }
];