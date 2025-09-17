'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { FlatAccountItem } from '@/types/account-items';
import { SpreadsheetData } from '@/hooks/use-spreadsheet';
import { NewItemsConfirmationDialog } from './new-items-confirmation-dialog';
import {
  createAccountItemsFromCSV,
  suggestAccountItemMapping
} from '@/lib/account-service';

interface CSVImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: SpreadsheetData) => Promise<void>;
  flatAccountItems: FlatAccountItem[];
  selectedMedia: string;
  selectedYear: number;
  onAccountItemsUpdated?: () => Promise<void>; // 勘定項目が更新された時のコールバック
}

interface ParsedCSVRow {
  大項目?: string;
  小項目?: string;
  項目?: string; // 旧形式対応
  [key: string]: string | undefined;
}

interface MappingResult {
  original: ParsedCSVRow;
  accountItemId: string | null;
  categoryName: string;
  itemName: string;
  status: 'mapped' | 'notFound' | 'multipleMatch' | 'newItem';
  possibleMatches?: FlatAccountItem[];
}

interface NewAccountItem {
  categoryName: string;
  itemName: string;
  isNewCategory: boolean;
}

const months = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export function CSVImportDialog({
  isOpen,
  onClose,
  onImport,
  flatAccountItems,
  selectedMedia,
  selectedYear,
  onAccountItemsUpdated
}: CSVImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping'>('upload');
  const [csvData, setCsvData] = useState<ParsedCSVRow[]>([]);
  const [mappingResults, setMappingResults] = useState<MappingResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [newItemsToCreate, setNewItemsToCreate] = useState<NewAccountItem[]>([]);
  const [isNewItemsDialogOpen, setIsNewItemsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSVテンプレートをダウンロード
  const downloadTemplate = () => {
    const actualItems = flatAccountItems.filter(item => !item.isCategory);
    const templateData = [
      ['大項目', '小項目', ...months], // ヘッダー
      ...actualItems.map(item => [
        item.categoryName,
        item.name,
        ...months.map(() => '0')
      ])
    ];

    const csv = Papa.unparse(templateData);
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `budget_template_${selectedMedia}_${selectedYear}.csv`;
    link.click();
    toast.success('CSVテンプレートをダウンロードしました');
  };

  // CSVファイルをアップロード
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    Papa.parse(file, {
      header: true,
      encoding: 'UTF-8',
      complete: async (results) => {
        const data = results.data as ParsedCSVRow[];
        const validData = data.filter(row =>
          row.大項目 || row.小項目 || row.項目 // 何らかの項目情報があるデータのみ
        );

        setCsvData(validData);
        await processMapping(validData);
        setStep('preview');
        setIsProcessing(false);
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast.error('CSVファイルの読み込みに失敗しました');
        setIsProcessing(false);
      }
    });
  };

  // CSVデータと勘定項目のマッピング処理
  const processMapping = async (data: ParsedCSVRow[]) => {
    const actualItems = flatAccountItems.filter(item => !item.isCategory);
    const results: MappingResult[] = [];
    const newItems: NewAccountItem[] = [];
    const existingCategories = new Set(flatAccountItems.map(item => item.categoryName));

    for (const row of data) {
      let categoryName = '';
      let itemName = '';
      let accountItemId: string | null = null;
      let status: MappingResult['status'] = 'notFound';
      let possibleMatches: FlatAccountItem[] = [];

      // 新形式（大項目・小項目）
      if (row.大項目 && row.小項目) {
        categoryName = row.大項目;
        itemName = row.小項目;

        // 完全一致を探す
        const exactMatch = actualItems.find(item =>
          item.categoryName === categoryName && item.name === itemName
        );

        if (exactMatch) {
          accountItemId = exactMatch.id;
          status = 'mapped';
        } else {
          // 高度な類似度チェック
          possibleMatches = await suggestAccountItemMapping(categoryName, itemName);

          if (possibleMatches.length === 1) {
            accountItemId = possibleMatches[0].id;
            status = 'mapped';
            possibleMatches = [];
          } else if (possibleMatches.length > 1) {
            status = 'multipleMatch';
          } else {
            // 新項目として追加候補にする
            status = 'newItem';
            const isNewCategory = !existingCategories.has(categoryName);
            newItems.push({
              categoryName,
              itemName,
              isNewCategory
            });
          }
        }
      }
      // 旧形式（項目のみ）
      else if (row.項目) {
        itemName = row.項目;
        categoryName = 'その他'; // デフォルトカテゴリ

        // 項目名での一致を探す
        const matches = actualItems.filter(item =>
          item.name === itemName ||
          item.fullName.includes(itemName) ||
          itemName.includes(item.name)
        );

        if (matches.length === 1) {
          accountItemId = matches[0].id;
          categoryName = matches[0].categoryName;
          status = 'mapped';
        } else if (matches.length > 1) {
          possibleMatches = matches;
          status = 'multipleMatch';
        } else {
          // 新項目として追加候補にする
          status = 'newItem';
          const isNewCategory = !existingCategories.has(categoryName);
          newItems.push({
            categoryName,
            itemName,
            isNewCategory
          });
        }
      }

      results.push({
        original: row,
        accountItemId,
        categoryName,
        itemName,
        status,
        possibleMatches
      });
    }

    setMappingResults(results);
    setNewItemsToCreate(newItems);
  };

  // マッピングを手動で更新
  const updateMapping = (index: number, accountItemId: string) => {
    const actualItems = flatAccountItems.filter(item => !item.isCategory);
    const selectedItem = actualItems.find(item => item.id === accountItemId);

    if (selectedItem) {
      const newResults = [...mappingResults];
      newResults[index] = {
        ...newResults[index],
        accountItemId: selectedItem.id,
        categoryName: selectedItem.categoryName,
        itemName: selectedItem.name,
        status: 'mapped',
        possibleMatches: []
      };
      setMappingResults(newResults);
    }
  };

  // 新項目作成の処理
  const handleCreateNewItems = async (selectedItems: NewAccountItem[]) => {
    try {
      if (selectedItems.length === 0) return;

      const { createdItems } = await createAccountItemsFromCSV(selectedItems);

      // 勘定項目リストの更新を通知
      if (onAccountItemsUpdated) {
        await onAccountItemsUpdated();
      }

      // マッピング結果を更新（新しく作成された項目を反映）
      const updatedResults = [...mappingResults];

      updatedResults.forEach((result, index) => {
        if (result.status === 'newItem') {
          const createdItem = createdItems.find(item =>
            item.name === result.itemName && item.categoryId // categoryIdも確認
          );
          if (createdItem) {
            updatedResults[index] = {
              ...result,
              accountItemId: createdItem.id,
              categoryName: result.categoryName,
              itemName: result.itemName,
              status: 'mapped'
            };
          }
        }
      });

      setMappingResults(updatedResults);
      setIsNewItemsDialogOpen(false);

      toast.success(`${createdItems.length}項目を作成しました`);

    } catch (error) {
      console.error('Error creating new items:', error);
      toast.error('新項目の作成に失敗しました');
    }
  };

  // インポート実行
  const executeImport = async () => {
    // 新項目がある場合は確認ダイアログを表示
    if (newItemsToCreate.length > 0) {
      setIsNewItemsDialogOpen(true);
      return;
    }

    await performImport();
  };

  // 実際のインポート処理
  const performImport = async () => {
    setIsProcessing(true);

    try {
      const importData: SpreadsheetData = {};

      // 最新のマッピング結果を使用
      const currentMappingResults = [...mappingResults];
      console.log('Current mapping results for import:', currentMappingResults);

      currentMappingResults.forEach(result => {
        if (result.accountItemId && result.status === 'mapped') {
          const monthlyData: Record<string, number> = {};

          months.forEach(month => {
            const value = result.original[month];
            if (value !== undefined && value !== null && value !== '') {
              const numValue = parseFloat(value.replace(/[,\s]/g, ''));
              if (!isNaN(numValue)) { // 数値として有効な値のみ保存（0を含む）
                monthlyData[month] = numValue;
              }
            }
          });

          // データがある場合のみ追加
          if (Object.keys(monthlyData).length > 0) {
            importData[result.accountItemId] = monthlyData;
            console.log(`Added data for ${result.accountItemId}:`, monthlyData);
          }
        }
      });

      console.log('Final import data:', importData);
      await onImport(importData);

      const mappedCount = currentMappingResults.filter(r => r.status === 'mapped').length;
      toast.success(`${mappedCount}項目のデータをインポートしました`);

      // ダイアログを閉じてリセット
      handleClose();

    } catch (error) {
      console.error('Import error:', error);
      toast.error('インポート中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  // ダイアログを閉じる
  const handleClose = () => {
    setStep('upload');
    setCsvData([]);
    setMappingResults([]);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const mappedCount = mappingResults.filter(r => r.status === 'mapped').length;
  const notFoundCount = mappingResults.filter(r => r.status === 'notFound').length;
  const multipleMatchCount = mappingResults.filter(r => r.status === 'multipleMatch').length;
  const newItemCount = mappingResults.filter(r => r.status === 'newItem').length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>CSV インポート</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    CSVテンプレートをダウンロード
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    現在の勘定項目に基づいたCSVテンプレートをダウンロードして、データを入力してください。
                  </p>
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    テンプレートダウンロード
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    CSVファイルをアップロード
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        対応形式：
                        <br />• 新形式：大項目, 小項目, 1月, 2月, ...
                        <br />• 旧形式：項目, 1月, 2月, ...
                      </AlertDescription>
                    </Alert>

                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      disabled={isProcessing}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Preview & Mapping */}
          {step === 'preview' && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex gap-4 flex-wrap">
                <Badge variant={mappedCount > 0 ? "default" : "secondary"}>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  マッピング済み: {mappedCount}
                </Badge>
                <Badge variant={newItemCount > 0 ? "outline" : "secondary"}>
                  <Plus className="h-3 w-3 mr-1" />
                  新項目: {newItemCount}
                </Badge>
                <Badge variant={multipleMatchCount > 0 ? "destructive" : "secondary"}>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  複数候補: {multipleMatchCount}
                </Badge>
                <Badge variant={notFoundCount > 0 ? "destructive" : "secondary"}>
                  未マッピング: {notFoundCount}
                </Badge>
              </div>

              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CSVデータ</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>マッピング先</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappingResults.map((result, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {result.original.大項目 && result.original.小項目
                                ? `${result.original.大項目} › ${result.original.小項目}`
                                : result.original.項目 || '不明'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              データ: {months.slice(0, 3).map(month =>
                                result.original[month] || '0'
                              ).join(', ')}...
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {result.status === 'mapped' && (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              マッピング済み
                            </Badge>
                          )}
                          {result.status === 'notFound' && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              未発見
                            </Badge>
                          )}
                          {result.status === 'multipleMatch' && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              複数候補
                            </Badge>
                          )}
                          {result.status === 'newItem' && (
                            <Badge variant="outline">
                              <Plus className="h-3 w-3 mr-1" />
                              新項目として作成
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.status === 'mapped' ? (
                            <div className="text-sm">
                              {result.categoryName} › {result.itemName}
                            </div>
                          ) : (
                            <Select
                              value={result.accountItemId || ''}
                              onValueChange={(value) => updateMapping(index, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="項目を選択..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(result.possibleMatches && result.possibleMatches.length > 0
                                  ? result.possibleMatches
                                  : flatAccountItems.filter(item => !item.isCategory)
                                ).map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.fullName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            キャンセル
          </Button>
          {step === 'upload' && (
            <Button disabled>
              CSVファイルを選択してください
            </Button>
          )}
          {step === 'preview' && (
            <Button
              onClick={executeImport}
              disabled={isProcessing || (mappedCount + newItemCount) === 0}
            >
              {isProcessing
                ? 'インポート中...'
                : newItemCount > 0
                ? `${mappedCount + newItemCount}項目をインポート（${newItemCount}項目作成）`
                : `${mappedCount}項目をインポート`
              }
            </Button>
          )}
        </DialogFooter>

        {/* 新項目確認ダイアログ */}
        <NewItemsConfirmationDialog
          isOpen={isNewItemsDialogOpen}
          onClose={() => setIsNewItemsDialogOpen(false)}
          onConfirm={async (selectedItems) => {
            await handleCreateNewItems(selectedItems);
            await performImport();
          }}
          newItems={newItemsToCreate}
          isProcessing={isProcessing}
        />
      </DialogContent>
    </Dialog>
  );
}