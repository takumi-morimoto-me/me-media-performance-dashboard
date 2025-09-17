'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAccountCategories,
  createAccountCategory,
  updateAccountCategory,
  deleteAccountCategory,
  createAccountItem,
  updateAccountItem,
  deleteAccountItem,
  initializeDefaultAccountStructure
} from '@/lib/account-service';
import { AccountCategory, AccountItem } from '@/types/account-items';

export function AccountItemManager() {
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Category dialogs
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AccountCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Item dialogs
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Delete dialogs
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'item'; data: AccountCategory | AccountItem } | null>(null);

  // データ読み込み
  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const data = await getAccountCategories();
      setCategories(data);

      // すべてのカテゴリを展開状態にする
      setExpandedCategories(new Set(data.map(cat => cat.id)));
    } catch (error) {
      toast.error('勘定項目の読み込みに失敗しました');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // 初期化
  const handleInitialize = async () => {
    try {
      await initializeDefaultAccountStructure();
      toast.success('デフォルトの勘定項目を設定しました');
      loadCategories();
    } catch (error) {
      toast.error('初期化に失敗しました');
      console.error(error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // カテゴリ関連の操作
  const openCategoryDialog = (category?: AccountCategory) => {
    setEditingCategory(category || null);
    setCategoryName(category?.name || '');
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.warning('カテゴリ名を入力してください');
      return;
    }

    try {
      if (editingCategory) {
        await updateAccountCategory(editingCategory.id, { name: categoryName.trim() });
        toast.success('カテゴリを更新しました');
      } else {
        await createAccountCategory({ name: categoryName.trim() });
        toast.success('カテゴリを作成しました');
      }
      setIsCategoryDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast.error(editingCategory ? 'カテゴリの更新に失敗しました' : 'カテゴリの作成に失敗しました');
      console.error(error);
    }
  };

  // アイテム関連の操作
  const openItemDialog = (categoryId: string, item?: AccountItem) => {
    setEditingItem(item || null);
    setItemName(item?.name || '');
    setSelectedCategoryId(categoryId);
    setIsItemDialogOpen(true);
  };

  const handleSaveItem = async () => {
    if (!itemName.trim()) {
      toast.warning('項目名を入力してください');
      return;
    }

    try {
      if (editingItem) {
        await updateAccountItem(editingItem.id, { name: itemName.trim() });
        toast.success('項目を更新しました');
      } else {
        await createAccountItem({
          name: itemName.trim(),
          categoryId: selectedCategoryId
        });
        toast.success('項目を作成しました');
      }
      setIsItemDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast.error(editingItem ? '項目の更新に失敗しました' : '項目の作成に失敗しました');
      console.error(error);
    }
  };

  // 削除操作
  const openDeleteDialog = (type: 'category' | 'item', data: AccountCategory | AccountItem) => {
    setDeleteTarget({ type, data });
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'category') {
        await deleteAccountCategory(deleteTarget.data.id);
        toast.success('カテゴリを削除しました');
      } else {
        await deleteAccountItem(deleteTarget.data.id);
        toast.success('項目を削除しました');
      }
      setIsDeleteDialogOpen(false);
      loadCategories();
    } catch (error) {
      toast.error('削除に失敗しました');
      console.error(error);
    }
  };

  // カテゴリの展開/折りたたみ
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>勘定項目設定</CardTitle>
          <CardDescription>読み込み中...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>勘定項目設定</CardTitle>
          <CardDescription>
            大項目と小項目の階層構造で勘定項目を管理します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <Button onClick={() => openCategoryDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              大項目を追加
            </Button>
            {categories.length === 0 && (
              <Button variant="outline" onClick={handleInitialize}>
                デフォルト項目を設定
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category.id} className="border rounded-lg">
                <div className="flex items-center justify-between p-4 bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCategory(category.id)}
                    >
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <h3 className="font-semibold">{category.name}</h3>
                    <span className="text-sm text-muted-foreground">
                      ({category.items.length}項目)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openItemDialog(category.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      項目追加
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openCategoryDialog(category)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog('category', category)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {expandedCategories.has(category.id) && (
                  <div className="p-4 pt-0">
                    {category.items.length === 0 ? (
                      <p className="text-muted-foreground text-sm">項目がありません</p>
                    ) : (
                      <div className="space-y-2">
                        {category.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded border bg-background"
                          >
                            <span>{item.name}</span>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openItemDialog(category.id, item)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openDeleteDialog('item', item)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* カテゴリ編集ダイアログ */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'カテゴリを編集' : '新しいカテゴリを追加'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="カテゴリ名"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveCategory}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 項目編集ダイアログ */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '項目を編集' : '新しい項目を追加'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="項目名"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSaveItem}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'category'
                ? `カテゴリ「${deleteTarget.data.name}」とその中のすべての項目を削除します。`
                : `項目「${deleteTarget?.data.name}」を削除します。`}
              この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}