'use client';

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import Papa from "papaparse";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Upload, Trash2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useSpreadsheet, SpreadsheetData } from "@/hooks/use-spreadsheet";
import { EditableCell } from "./editable-cell";
import { CSVImportDialog } from "./csv-import-dialog";
import { formatCellValue, parseNumberInput } from "@/lib/utils";
import {
  getMedia,
  MediaConfig
} from "@/lib/media-service";
import {
  getFlatAccountItems,
  deleteAccountItem,
  initializeDefaultAccountItems,
  checkMigrationStatus,
  migrateFromLegacyStructure
} from "@/lib/accounts-service";
import { FlatAccountItem } from "@/types/account-items";

interface HierarchicalSpreadsheetGridProps {
  selectedMedia: string;
  selectedYear: number;
  selectedMonth: number;
  isDailyView: boolean;
}

const months = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month, 0).getDate();
};

export function HierarchicalSpreadsheetGrid({
  selectedMedia,
  selectedYear,
  selectedMonth,
  isDailyView
}: HierarchicalSpreadsheetGridProps) {
  const [gridData, setGridData] = useState<SpreadsheetData>({});
  const [flatAccountItems, setFlatAccountItems] = useState<FlatAccountItem[]>([]);
  const [mediaConfig, setMediaConfig] = useState<MediaConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // 削除機能用の状態
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'item'; item: FlatAccountItem } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const daysInSelectedMonth = getDaysInMonth(selectedYear, selectedMonth);

  // 表示する列を決定
  const columns = isDailyView
    ? Array.from({ length: daysInSelectedMonth }, (_, i) => `${selectedMonth}/${i + 1}`)
    : months;

  // データ変更時の処理
  const handleDataChange = useCallback((newData: SpreadsheetData) => {
    setGridData(newData);
  }, []);

  // セルの値を変更するハンドラー
  const handleCellChange = useCallback((row: number, col: number, value: string) => {
    if (isDailyView) return; // 日次ビューでは編集不可

    const actualItems = flatAccountItems.filter(item => !item.isCategory);
    if (row >= actualItems.length || col >= columns.length) {
      return;
    }

    const itemId = actualItems[row].id;
    const colKey = columns[col];

    // カンマを除去して数値に変換
    const numericValue = parseNumberInput(value);

    const newData = {
      ...gridData,
      [itemId]: {
        ...gridData[itemId],
        [colKey]: numericValue
      }
    };

    handleDataChange(newData);
  }, [gridData, handleDataChange, flatAccountItems, columns, isDailyView]);

  // バッチセル変更処理（ペースト用）
  const handleBatchCellChange = useCallback((changes: Array<{row: number, col: number, value: string}>) => {
    if (isDailyView) return; // 日次ビューでは編集不可

    const actualItems = flatAccountItems.filter(item => !item.isCategory);
    const newData = { ...gridData };

    changes.forEach(({row, col, value}) => {
      if (row >= actualItems.length || col >= columns.length) return;

      const itemId = actualItems[row].id;
      const colKey = columns[col];

      if (!newData[itemId]) {
        newData[itemId] = {};
      }

      // カンマを除去して数値に変換
      newData[itemId][colKey] = parseNumberInput(value);
    });

    handleDataChange(newData);
  }, [gridData, handleDataChange, flatAccountItems, columns, isDailyView]);

  // セルの実際の値を取得する関数（編集用 - フォーマットなし）
  const getCellValue = useCallback((row: number, col: number): string => {
    const actualItems = flatAccountItems.filter(item => !item.isCategory);
    if (row >= actualItems.length || col >= columns.length) {
      return '';
    }

    const itemId = actualItems[row].id;
    const key = columns[col];

    if (isDailyView) {
      // 日次ビューでは月間の値を日割り計算
      const monthKey = `${selectedMonth}月`;
      const monthlyValue = gridData[itemId]?.[monthKey] || 0;
      const dailyValue = daysInSelectedMonth > 0 ? Number(monthlyValue) / daysInSelectedMonth : 0;
      return dailyValue.toString();
    } else {
      const value = gridData[itemId]?.[key] || 0;
      return String(value);
    }
  }, [flatAccountItems, columns, gridData, isDailyView, selectedMonth, daysInSelectedMonth]);

  // セルの表示用フォーマット値を取得する関数
  const getFormattedCellValue = useCallback((row: number, col: number): string => {
    const rawValue = getCellValue(row, col);
    return formatCellValue(rawValue, isDailyView);
  }, [getCellValue, isDailyView]);

  const actualItems = flatAccountItems.filter(item => !item.isCategory);

  const {
    selectedCell,
    editingCell,
    editValue,
    setEditValue,
    selectCell,
    startEditing,
    handleKeyDown,
    handlePaste,
    tableRef,
    inputRef,
  } = useSpreadsheet({
    data: gridData,
    rowCount: actualItems.length,
    onDataChange: handleDataChange,
    onCellChange: handleCellChange,
    onBatchCellChange: handleBatchCellChange,
    isEditingDisabled: isDailyView,
    getCellValue,
  });

  // データ読み込み
  const fetchBudgetData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGridData({});

    if (!selectedMedia || !selectedYear) {
      setIsLoading(false);
      return;
    }

    // "all" の場合は全体用の処理をスキップ
    if (selectedMedia === "all") {
      setIsLoading(false);
      setError("全体表示は現在対応していません。具体的なメディアを選択してください。");
      return;
    }

    try {
      const media = await getMedia(selectedMedia);
      setMediaConfig(media);

      const docRef = doc(db, "budgets", `${selectedMedia}-${selectedYear}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setGridData(docSnap.data());
      } else {
        // 新しいメディア/年度の場合、空のデータで初期化
        const initialData: SpreadsheetData = {};
        const items = await getFlatAccountItems(selectedMedia);
        items.filter(item => !item.isCategory).forEach(item => {
          initialData[item.id] = Object.fromEntries(months.map(month => [month, 0]));
        });
        setGridData(initialData);
      }
    } catch (err) {
      console.error("Error fetching budget data:", err);
      setError("データの読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMedia, selectedYear]);

  // 勘定項目データ読み込み
  const loadAccountItems = useCallback(async () => {
    if (!selectedMedia) return;

    // "all" の場合は勘定項目を空にする
    if (selectedMedia === "all") {
      setFlatAccountItems([]);
      return;
    }

    try {
      // 移行状況をチェック
      const isMigrated = await checkMigrationStatus();
      if (!isMigrated) {
        console.log('Migration not completed, running migration...');
        await migrateFromLegacyStructure();
      }

      const items = await getFlatAccountItems(selectedMedia);
      setFlatAccountItems(items);
    } catch (error) {
      console.error("Error loading account items:", error);
      toast.error("勘定項目の読み込みに失敗しました");
    }
  }, [selectedMedia]);

  useEffect(() => {
    loadAccountItems();
  }, [loadAccountItems]);

  useEffect(() => {
    if (flatAccountItems.length > 0) {
      fetchBudgetData();
    }
  }, [fetchBudgetData, flatAccountItems.length]);

  // データ保存
  const saveBudgetData = async () => {
    if (!selectedMedia || !selectedYear) return;

    try {
      const docRef = doc(db, "budgets", `${selectedMedia}-${selectedYear}`);
      await setDoc(docRef, gridData);
      toast.success("データを保存しました");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("データの保存に失敗しました");
    }
  };

  // CSVエクスポート
  const exportToCSV = () => {
    const actualItemsOnly = flatAccountItems.filter(item => !item.isCategory);
    const csvData = [
      ["大項目", "小項目", ...columns],
      ...actualItemsOnly.map(item => [
        item.categoryName,
        item.name,
        ...columns.map(col => getCellValue(actualItemsOnly.indexOf(item), columns.indexOf(col)))
      ])
    ];

    const csv = Papa.unparse(csvData);
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `budget_${selectedYear}_${mediaConfig?.name || selectedMedia}.csv`;
    link.click();
    toast.success("CSVファイルをダウンロードしました");
  };

  // CSVインポート処理
  const handleCSVImport = async (importData: SpreadsheetData) => {
    try {
      console.log("Importing CSV data:", importData);

      // 既存データとマージ
      const mergedData = { ...gridData, ...importData };
      console.log("Merged data:", mergedData);

      // ローカル状態を更新
      setGridData(mergedData);

      // Firestoreに保存
      const docRef = doc(db, "budgets", `${selectedMedia}-${selectedYear}`);
      await setDoc(docRef, mergedData);

      // データを再読み込みして最新状態を確保
      await fetchBudgetData();

      toast.success("CSVデータを正常にインポートしました");
    } catch (error) {
      console.error("Error importing CSV data:", error);
      toast.error("CSVインポート中にエラーが発生しました");
      throw error;
    }
  };

  // 削除機能
  const handleDeleteClick = (item: FlatAccountItem) => {
    const type = item.isCategory ? 'category' : 'item';
    setDeleteTarget({ type, item });
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    console.log('Delete target:', deleteTarget);
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'category') {
        // カテゴリ削除の場合、そのカテゴリに属する全てのアイテムも削除される
        // カテゴリIDから接頭辞を除去（category-xxxの場合）
        const actualCategoryId = deleteTarget.item.id.startsWith('category-')
          ? deleteTarget.item.id.replace('category-', '')
          : deleteTarget.item.id;
        console.log('Original category ID:', deleteTarget.item.id, 'Actual category ID:', actualCategoryId);

        // 新構造ではカテゴリ削除は単一アイテムの削除
        await deleteAccountItem(actualCategoryId);

        // 同じカテゴリの他のアイテムも削除
        const allItems = await getFlatAccountItems(selectedMedia);
        const categoryItems = allItems.filter(item =>
          !item.isCategory && item.categoryName === deleteTarget.item.name
        );

        for (const item of categoryItems) {
          await deleteAccountItem(item.id);
        }

        toast.success('カテゴリと関連項目を削除しました');
      } else {
        // アイテム削除
        await deleteAccountItem(deleteTarget.item.id);
        toast.success('項目を削除しました');
      }

      // 勘定項目を再読み込み
      await loadAccountItems();

      // 予算データも再読み込み（削除されたアイテムの関連データを除去）
      await fetchBudgetData();

      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>予算管理</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full h-96" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>予算管理</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>
            {isDailyView ? `${selectedYear}年${selectedMonth}月の日次予算` : `${selectedYear}年の月次予算`}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(true)}
              disabled={isDailyView}
            >
              <Upload className="h-4 w-4 mr-2" />
              CSVインポート
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              CSVエクスポート
            </Button>
            <Button onClick={saveBudgetData}>
              保存
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-[600px]">
          <Table
            ref={tableRef}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            tabIndex={0}
            className="min-w-full"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">
                  項目
                </TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="min-w-[100px] text-center">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {flatAccountItems.map((item) => {
                if (item.isCategory) {
                  // カテゴリヘッダー行
                  return (
                    <TableRow key={item.id} className="bg-muted/50">
                      <td className="sticky left-0 bg-muted/50 z-10 font-semibold p-3">
                        <div className="flex items-center justify-between">
                          <span>{item.name}</span>
                          {selectedMedia !== "all" && !isDailyView && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(item)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      {columns.map((col) => (
                        <td key={col} className="p-3 text-center text-muted-foreground">
                          -
                        </td>
                      ))}
                    </TableRow>
                  );
                } else {
                  // 実際のデータ行
                  const actualRowIndex = actualItems.findIndex(actualItem => actualItem.id === item.id);

                  return (
                    <TableRow key={item.id}>
                      <td className="sticky left-0 bg-background z-10 p-0">
                        <div className="p-3 pl-6 flex items-center justify-between">
                          <span>{item.name}</span>
                          {selectedMedia !== "all" && !isDailyView && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(item)}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      {columns.map((col, colIndex) => (
                        <EditableCell
                          key={col}
                          value={getCellValue(actualRowIndex, colIndex)}
                          formattedValue={getFormattedCellValue(actualRowIndex, colIndex)}
                          isSelected={selectedCell?.row === actualRowIndex && selectedCell?.col === colIndex}
                          isEditing={editingCell?.row === actualRowIndex && editingCell?.col === colIndex}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
                          onCellClick={() => selectCell(actualRowIndex, colIndex, getCellValue(actualRowIndex, colIndex))}
                          onDoubleClick={() => startEditing(actualRowIndex, colIndex, getCellValue(actualRowIndex, colIndex))}
                          onKeyDown={handleKeyDown}
                          onPaste={handlePaste}
                          className={isDailyView ? "opacity-50" : ""}
                        />
                      ))}
                    </TableRow>
                  );
                }
              })}
            </TableBody>
          </Table>
        </div>

        {flatAccountItems.length === 0 && selectedMedia !== "all" && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">勘定項目が設定されていません</p>
            <p className="text-sm text-muted-foreground">
              設定画面で勘定項目を追加してください
            </p>
          </div>
        )}
      </CardContent>

      {/* CSV インポートダイアログ */}
      <CSVImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleCSVImport}
        flatAccountItems={flatAccountItems}
        selectedMedia={selectedMedia}
        selectedYear={selectedYear}
        onAccountItemsUpdated={loadAccountItems}
      />

      {/* 削除確認ダイアログ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>項目の削除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'category' ? (
                <>
                  カテゴリ「<strong>{deleteTarget.item.name}</strong>」とその中のすべての項目を削除します。
                  <br />
                  この操作により、関連する予算データも削除されます。
                </>
              ) : (
                <>
                  項目「<strong>{deleteTarget?.item.name}</strong>」を削除します。
                  <br />
                  この操作により、この項目の予算データも削除されます。
                </>
              )}
              <br />
              <br />
              この操作は元に戻すことができません。本当に削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? '削除中...' : '削除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}