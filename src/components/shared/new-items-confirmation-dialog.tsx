'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Plus, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface NewAccountItem {
  categoryName: string;
  itemName: string;
  isNewCategory: boolean;
}

interface NewItemsConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedItems: NewAccountItem[]) => Promise<void>;
  newItems: NewAccountItem[];
  isProcessing?: boolean;
}

export function NewItemsConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  newItems,
  isProcessing = false
}: NewItemsConfirmationDialogProps) {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(
    new Set(Array.from({ length: newItems.length }, (_, i) => i))
  );

  // すべて選択/解除
  const toggleSelectAll = () => {
    if (selectedItems.size === newItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(Array.from({ length: newItems.length }, (_, i) => i)));
    }
  };

  // 個別選択の切り替え
  const toggleSelectItem = (index: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedItems(newSelection);
  };

  // 確認実行
  const handleConfirm = async () => {
    const itemsToCreate = Array.from(selectedItems).map(index => newItems[index]);
    await onConfirm(itemsToCreate);
  };

  // ダイアログを閉じる
  const handleClose = () => {
    setSelectedItems(new Set(Array.from({ length: newItems.length }, (_, i) => i)));
    onClose();
  };

  // 統計情報
  const newCategoriesCount = newItems.filter(item => item.isNewCategory).length;
  const newItemsCount = newItems.length;
  const selectedNewItems = Array.from(selectedItems).map(i => newItems[i]);
  const selectedNewCategoriesCount = selectedNewItems.filter(item => item.isNewCategory).length;

  // カテゴリ別グループ化
  const groupedItems = newItems.reduce((groups, item, index) => {
    const key = item.categoryName;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push({ ...item, index });
    return groups;
  }, {} as Record<string, Array<NewAccountItem & { index: number }>>);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            新しい勘定項目の作成確認
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              CSVに含まれている以下の項目が勘定項目設定に存在しません。
              これらの項目を自動的に作成しますか？
            </AlertDescription>
          </Alert>

          {/* 統計情報 */}
          <div className="flex gap-4">
            <Badge variant="outline">
              <Plus className="h-3 w-3 mr-1" />
              新カテゴリ: {selectedNewCategoriesCount}/{newCategoriesCount}
            </Badge>
            <Badge variant="outline">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              新項目: {selectedItems.size}/{newItemsCount}
            </Badge>
          </div>

          {/* 選択コントロール */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selectedItems.size === newItems.length}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              すべて選択 ({selectedItems.size}/{newItems.length})
            </label>
          </div>

          {/* 項目リスト */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([categoryName, items]) => (
                <div key={categoryName} className="border rounded-lg">
                  <div className="bg-muted/50 px-4 py-2 flex items-center gap-2">
                    <h3 className="font-semibold">{categoryName}</h3>
                    {items[0].isNewCategory && (
                      <Badge variant="secondary" className="text-xs">
                        新カテゴリ
                      </Badge>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.index}
                          className="flex items-center gap-3 p-2 rounded border"
                        >
                          <Checkbox
                            id={`item-${item.index}`}
                            checked={selectedItems.has(item.index)}
                            onCheckedChange={() => toggleSelectItem(item.index)}
                          />
                          <label
                            htmlFor={`item-${item.index}`}
                            className="flex-1 text-sm cursor-pointer"
                          >
                            {item.itemName}
                          </label>
                          <Badge variant="outline" className="text-xs">
                            新項目
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {newItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              新しく作成する項目はありません。
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing || selectedItems.size === 0}
          >
            {isProcessing
              ? '作成中...'
              : `${selectedItems.size}項目を作成`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}