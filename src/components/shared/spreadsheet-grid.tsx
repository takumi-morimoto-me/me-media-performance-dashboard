'use client';

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus } from 'lucide-react';

import { Skeleton } from "@/components/ui/skeleton";
import { useSpreadsheet, SpreadsheetData } from "@/hooks/use-spreadsheet";
import { EditableCell } from "./editable-cell";
import { EditableRowHeader } from "./editable-row-header";
import { 
  getMedia, 
  addAccountItem, 
  removeAccountItem, 
  renameAccountItem,
  initializeExistingMedias,
  MediaConfig 
} from "@/lib/media-service";

interface SpreadsheetGridProps {
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

export function SpreadsheetGrid({
  selectedMedia,
  selectedYear,
  selectedMonth,
  isDailyView,
}: SpreadsheetGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gridData, setGridData] = useState<SpreadsheetData>({});
  const [mediaConfig, setMediaConfig] = useState<MediaConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const columns = isDailyView
    ? Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => `${i + 1}日`)
    : months;
  
  const daysInSelectedMonth = isDailyView ? getDaysInMonth(selectedYear, selectedMonth) : 0;

  // データ保存処理
  const saveBudgetData = useCallback(async (data: SpreadsheetData) => {
    if (!selectedMedia || !selectedYear) return;

    try {
      const docId = `${selectedMedia}_${selectedYear}`;
      const docRef = doc(db, "budgets", docId);
      await setDoc(docRef, data);
      toast.success("データが保存されました。");
    } catch (error) {
      console.error("Error saving budget data: ", error);
      toast.error("データの保存中にエラーが発生しました。");
    }
  }, [selectedMedia, selectedYear]);

  // データ変更時の自動保存処理
  const handleDataChange = useCallback(async (newData: SpreadsheetData) => {
    setGridData(newData);
    setHasUnsavedChanges(true);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      await saveBudgetData(newData);
      setHasUnsavedChanges(false);
    }, 1000);
  }, [saveBudgetData]);

  // セル変更処理
  const handleCellChange = useCallback((row: number, col: number, value: string) => {
    if (isDailyView) return; // 日次ビューでは編集不可

    const itemNames = mediaConfig?.accountItems || [];
    if (row >= itemNames.length || col >= columns.length) {
      return;
    }
    
    const itemName = itemNames[row];
    const key = columns[col];
    
    if (!itemName || !key) {
      return;
    }
    
    let processedValue: string | number = value;
    
    if (value === '' || value === null || value === undefined) {
      processedValue = 0;
    } else if (typeof value === 'string') {
      const trimmedValue = value.replace(/,/g, '').trim();
      if (trimmedValue && !isNaN(Number(trimmedValue))) {
        processedValue = Number(trimmedValue);
      } else {
        processedValue = value;
      }
    }
    
    const newData = {
      ...gridData,
      [itemName]: {
        ...gridData[itemName],
        [key]: processedValue
      }
    };
    
    handleDataChange(newData);
  }, [gridData, handleDataChange, columns, isDailyView, mediaConfig?.accountItems]);

  // バッチセル変更処理（ペースト用）
  const handleBatchCellChange = useCallback((changes: Array<{row: number, col: number, value: string}>) => {
    if (isDailyView) return; // 日次ビューでは編集不可

    const itemNames = mediaConfig?.accountItems || [];
    const newData = { ...gridData };
    
    changes.forEach(({row, col, value}) => {
      if (row >= itemNames.length || col >= columns.length) {
        return;
      }
      
      const itemName = itemNames[row];
      const key = columns[col];
      
      if (!itemName || !key) {
        return;
      }
      
      let processedValue: string | number = value;
      
      if (value === '' || value === null || value === undefined) {
        processedValue = 0;
      } else if (typeof value === 'string') {
        const trimmedValue = value.replace(/,/g, '').trim();
        if (trimmedValue && !isNaN(Number(trimmedValue))) {
          processedValue = Number(trimmedValue);
        } else {
          processedValue = value;
        }
      }
      
      if (!newData[itemName]) {
        newData[itemName] = {};
      }
      newData[itemName][key] = processedValue;
      
    });
    
    handleDataChange(newData);
  }, [gridData, handleDataChange, columns, isDailyView, mediaConfig?.accountItems]);

  // セルの実際の値を取得する関数
  const getCellValue = useCallback((row: number, col: number): string => {
    const itemNames = mediaConfig?.accountItems || [];
    if (row >= itemNames.length || col >= columns.length) {
      return '';
    }
    
    const itemName = itemNames[row];
    const key = columns[col];
    
    if (!itemName || !key) {
      return '';
    }
    
    if (isDailyView) {
      const monthKey = `${selectedMonth}月`;
      const monthlyValue = gridData[itemName]?.[monthKey] || 0;
      const dailyValue = daysInSelectedMonth > 0 ? monthlyValue / daysInSelectedMonth : 0;
      return dailyValue.toString();
    } else {
      const value = gridData[itemName]?.[key] || 0;
      return String(value);
    }
  }, [mediaConfig?.accountItems, columns, gridData, isDailyView, selectedMonth, daysInSelectedMonth]);

  const itemNames = mediaConfig?.accountItems || [];

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
    rowCount: itemNames.length,
    onDataChange: handleDataChange,
    onCellChange: handleCellChange,
    onBatchCellChange: handleBatchCellChange,
    isEditingDisabled: isDailyView,
    getCellValue,
  });

  const fetchBudgetData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGridData({});

    if (!selectedMedia || !selectedYear) {
      setIsLoading(false);
      return;
    }

    try {
      await initializeExistingMedias();
      const media = await getMedia(selectedMedia);
      setMediaConfig(media);

      const docId = `${selectedMedia}_${selectedYear}`;
      const docRef = doc(db, "budgets", docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setGridData(docSnap.data());
      } else {
        if (media) {
          const initialData: SpreadsheetData = {};
          media.accountItems.forEach(item => {
            initialData[item] = Object.fromEntries(months.map(month => [month, 0]));
          });
          setGridData(initialData);
          toast.info("新しい予算データを作成しました。");
        }
      }
    } catch (err) {
      console.error("Error fetching budget data: ", err);
      setError("データの取得中にエラーが発生しました。");
      toast.error("データの取得中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMedia, selectedYear]);

  useEffect(() => {
    fetchBudgetData();
  }, [selectedMedia, selectedYear, fetchBudgetData]); 

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error("ファイルが選択されませんでした。");
      return;
    }

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        toast.info("CSVファイルの解析を開始しました...");
        try {
          const newData: SpreadsheetData = {};
          
          for (const row of results.data as Record<string, unknown>[]) {
            const { Media, Year, Item, ...monthlyValues } = row;
            if (!Media || !Year || !Item) continue;
            
            if (Media === selectedMedia && Year === String(selectedYear)) {
              newData[Item as string] = Object.fromEntries(
                Object.entries(monthlyValues).map(([key, value]) => [
                  key,
                  typeof value === 'string' && !isNaN(Number(value.replace(/,/g, ''))) ? Number(value.replace(/,/g, '')) : 0
                ])
              );
            }
          }
          
          if (Object.keys(newData).length > 0) {
            await handleDataChange(newData);
            toast.success("CSVデータのインポートが完了しました。");
          } else {
            toast.warning("選択された条件に一致するデータが見つかりませんでした。");
          }
        } catch (error) {
          console.error("Error importing CSV data: ", error);
          toast.error("データのインポート中にエラーが発生しました。");
        }
      },
      error: (error) => {
        console.error("Error parsing CSV: ", error);
        toast.error("CSVファイルの解析中にエラーが発生しました。");
      },
    });
  };

  const handleImportClick = () => {
    if (isDailyView) {
      toast.info("CSVインポートは月次ビューでのみ利用可能です。");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleExportClick = () => {
    if (isDailyView) {
      toast.info("CSVエクスポートは月次ビューでのみ利用可能です。");
      return;
    }
    const csvData = Object.keys(gridData).map(itemName => {
      const row: Record<string, unknown> = {
        Media: selectedMedia,
        Year: selectedYear,
        Item: itemName,
      };
      months.forEach(month => {
        row[month] = gridData[itemName][month] || 0;
      });
      return row;
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `budget_${selectedMedia}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSVファイルをダウンロードしました。");
  };

  const addNewRow = async () => {
    if (!selectedMedia) return;
    
    const newItemName = `新項目${Object.keys(gridData).length + 1}`;
    try {
      await addAccountItem(selectedMedia, newItemName);
      
      const newRowData = Object.fromEntries(months.map(month => [month, 0]));
      const newData = {
        ...gridData,
        [newItemName]: newRowData
      };
      handleDataChange(newData);
      
      const updatedMedia = await getMedia(selectedMedia);
      setMediaConfig(updatedMedia);
      
      toast.success('新しい勘定項目を追加しました。');
    } catch (error) {
      console.error('Error adding account item:', error);
      toast.error('勘定項目の追加に失敗しました。');
    }
  };

  const handleRowNameChange = async (oldName: string, newName: string) => {
    if (!selectedMedia || oldName === newName) return;
    
    try {
      await renameAccountItem(selectedMedia, oldName, newName);
      
      const newData = { ...gridData };
      if (newData[oldName]) {
        newData[newName] = newData[oldName];
        delete newData[oldName];
        handleDataChange(newData);
      }
      
      const updatedMedia = await getMedia(selectedMedia);
      setMediaConfig(updatedMedia);
      
      toast.success('勘定項目名を変更しました。');
    } catch (error) {
      console.error('Error renaming account item:', error);
      toast.error('勘定項目名の変更に失敗しました。');
    }
  };

  const handleRowDelete = async (itemName: string) => {
    if (!selectedMedia) return;
    
    try {
      await removeAccountItem(selectedMedia, itemName);
      
      const newData = { ...gridData };
      delete newData[itemName];
      handleDataChange(newData);
      
      const updatedMedia = await getMedia(selectedMedia);
      setMediaConfig(updatedMedia);
      
      toast.success('勘定項目を削除しました。');
    } catch (error) {
      console.error('Error removing account item:', error);
      toast.error('勘定項目の削除に失敗しました。');
    }
  };

  if (isLoading) {
    return <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>;
  }

  if (error) {
    return <Card><CardContent><div className="flex h-96 items-center justify-center text-red-500">{error}</div></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center justify-between mb-4">
          <CardTitle>
            {isDailyView ? `${selectedYear}年${selectedMonth}月` : `${selectedYear}年`} 予算
            {hasUnsavedChanges && <span className="text-orange-500 text-sm ml-2">*</span>}
          </CardTitle>
          <div className="flex gap-2">
            
            <Button variant="outline" onClick={handleExportClick}>Export CSV</Button>
            <Button onClick={handleImportClick}>Import CSV</Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".csv"
            />
          </div>
        </div>
        {mediaConfig && (
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium">
              メディア: {mediaConfig.name}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div 
          className="relative w-full max-w-full overflow-auto rounded-lg border focus:outline-none"
          onKeyDown={(e) => {
            // セル選択時のみキーハンドリング、矢印キーのデフォルト動作を完全に阻止
            if (selectedCell && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Delete', 'Backspace', 'F2'].includes(e.key)) {
              e.preventDefault();
              e.stopPropagation();
              handleKeyDown(e);
            }
          }}
          onPaste={handlePaste}
          tabIndex={0}
          style={{ maxWidth: 'calc(100vw - 2rem)' }}
        >
          <Table ref={tableRef}>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-background border-r min-w-[200px] w-[200px]">
                  勘定項目
                </TableHead>
                {columns.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap text-center min-w-[120px] w-[120px]">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemNames.length === 0 ? (
                <TableRow>
                  <td colSpan={columns.length + 1} className="h-24 text-center">
                    勘定項目が設定されていません。設定ページでマスターデータを登録してください。
                  </td>
                </TableRow>
              ) : (
                itemNames.map((itemName, rowIndex) => (
                  <TableRow key={itemName} className="h-12">
                    <EditableRowHeader
                      value={itemName}
                      onValueChange={(newName) => handleRowNameChange(itemName, newName)}
                      onDelete={!isDailyView && itemNames.length > 1 ? () => handleRowDelete(itemName) : undefined}
                      className="min-w-[200px] w-[200px] z-[5] align-middle"
                      isEditable={!isDailyView}
                    />
                    {columns.map((col, colIndex) => {
                      const isEditable = !isDailyView;
                      let displayValue: string | number;
                      let originalValue: string | number;

                      if (isDailyView) {
                        const monthKey = `${selectedMonth}月`;
                        const monthlyValue = gridData[itemName]?.[monthKey] || 0;
                        const dailyValue = daysInSelectedMonth > 0 ? monthlyValue / daysInSelectedMonth : 0;
                        displayValue = dailyValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                        originalValue = displayValue;
                      } else {
                        originalValue = gridData[itemName]?.[col] || 0;
                        displayValue = Number(originalValue).toLocaleString();
                      }

                      const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                      const isEditing = isEditable && editingCell?.row === rowIndex && editingCell?.col === colIndex;
                      
                      return (
                        <EditableCell
                          key={`${rowIndex}-${colIndex}`}
                          ref={isEditing ? inputRef : undefined}
                          value={isEditing ? editValue : displayValue}
                          isSelected={isSelected}
                          isEditing={isEditing}
                          editValue={editValue}
                          onEditValueChange={setEditValue}
                          onCellClick={() => selectCell(rowIndex, colIndex, getCellValue(rowIndex, colIndex))}
                          onDoubleClick={() => isEditable && startEditing(rowIndex, colIndex, getCellValue(rowIndex, colIndex))}
                          onKeyDown={handleKeyDown}
                          onPaste={handlePaste}
                          className="text-right align-middle"
                        />
                      );
                    })}
                  </TableRow>
                ))
              )}
                          {!isDailyView && (
                <TableRow className="h-10 border-t">
                  <td 
                    colSpan={columns.length + 1} 
                    className="p-0 text-left"
                  >
                    <button 
                      onClick={addNewRow} 
                      className="w-full h-full flex items-center px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:bg-transparent disabled:cursor-not-allowed"
                      disabled={isDailyView}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      新規追加
                    </button>
                  </td>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-xs text-gray-500 space-y-1">
          <div>💡 操作方法:</div>
          <div>• 月次ビューでセルをクリックまたはF2キーで編集開始</div>
          <div>• 矢印キーでセル移動、Tab/Enterで次のセルに移動</div>
          <div>• Ctrl+V でスプレッドシートからデータをペースト可能</div>
          <div>• 変更は1秒後に自動的に保存されます</div>
        </div>
      </CardContent>
    </Card>
  );
}
