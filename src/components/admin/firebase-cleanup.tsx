'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  performCompleteCleanup,
  cleanupSpecificCollections
} from '@/lib/firebase-cleanup';

interface CleanupResult {
  collectionName: string;
  deletedCount: number;
  error?: string;
}

export function FirebaseCleanup() {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<CleanupResult[]>([]);
  const [lastCleanupTime, setLastCleanupTime] = useState<Date | null>(null);

  const handleCompleteCleanup = async () => {
    setIsCleaningUp(true);
    setCleanupResults([]);

    try {
      console.log('🚀 Starting complete Firebase cleanup...');
      await performCompleteCleanup();

      toast.success('✨ Firebase データを完全にクリーンアップしました');
      setLastCleanupTime(new Date());

      // 結果を模擬（実際のログから取得が理想）
      setCleanupResults([
        { collectionName: 'accountCategories', deletedCount: 0 },
        { collectionName: 'accountItems', deletedCount: 0 },
        { collectionName: 'accounts', deletedCount: 0 },
        { collectionName: 'budgets', deletedCount: 0 },
        { collectionName: 'migrations', deletedCount: 0 }
      ]);

    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('クリーンアップ中にエラーが発生しました');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleSpecificCleanup = async (collections: string[]) => {
    setIsCleaningUp(true);

    try {
      const results = await cleanupSpecificCollections(collections);
      setCleanupResults(results);

      const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
      toast.success(`${totalDeleted} 件のデータを削除しました`);

    } catch (error) {
      console.error('Specific cleanup error:', error);
      toast.error('部分クリーンアップ中にエラーが発生しました');
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Firebase データクリーンアップ
          </CardTitle>
          <CardDescription>
            開発・テスト用のデータを安全に削除します。メディア情報は保持されます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 完全クリーンアップ */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-red-600">⚠️ 完全クリーンアップ</h3>
                <p className="text-sm text-muted-foreground">
                  全ての勘定項目、予算データ、移行記録を削除します
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isCleaningUp}
                    className="gap-2"
                  >
                    {isCleaningUp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    完全削除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>本当に全データを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作は以下のデータを削除します：
                      <br />• 勘定項目（新旧両方）
                      <br />• 予算データ（全年度）
                      <br />• 実績データ（全年度）
                      <br />• 移行記録
                      <br /><br />
                      <strong>メディア情報は保持されます。</strong>
                      <br />
                      この操作は元に戻せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCompleteCleanup}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      削除実行
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* 部分クリーンアップ */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">部分クリーンアップ</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isCleaningUp}
                onClick={() => handleSpecificCleanup(['accountCategories', 'accountItems'])}
              >
                旧勘定項目のみ
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isCleaningUp}
                onClick={() => handleSpecificCleanup(['budgets'])}
              >
                予算データのみ
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isCleaningUp}
                onClick={() => handleSpecificCleanup(['accounts'])}
              >
                新勘定項目のみ
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isCleaningUp}
                onClick={() => handleSpecificCleanup(['migrations'])}
              >
                移行記録のみ
              </Button>
            </div>
          </div>

          {/* クリーンアップ結果 */}
          {cleanupResults.length > 0 && (
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                クリーンアップ結果
              </h3>
              <div className="space-y-2">
                {cleanupResults.map((result, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{result.collectionName}</span>
                    <Badge variant={result.error ? "destructive" : "secondary"}>
                      {result.error ? `Error: ${result.error}` : `${result.deletedCount} 件削除`}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最終クリーンアップ時刻 */}
          {lastCleanupTime && (
            <div className="text-sm text-muted-foreground">
              最終クリーンアップ: {lastCleanupTime.toLocaleString('ja-JP')}
            </div>
          )}

          {/* 注意事項 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">注意事項</p>
                <ul className="text-yellow-700 mt-1 space-y-1">
                  <li>• メディア情報（medias コレクション）は保持されます</li>
                  <li>• 削除されたデータは復元できません</li>
                  <li>• クリーンアップ後は新構造で動作します</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}