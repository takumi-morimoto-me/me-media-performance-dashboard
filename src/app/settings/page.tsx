'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMedias } from '@/contexts/media-context';
import { 
  createMedia, 
  updateMedia, 
  deleteMedia, 
  MediaConfig 
} from '@/lib/media-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { AccountItemManager } from '@/components/settings/account-item-manager';
import { FirebaseCleanup } from '@/components/admin/firebase-cleanup';
import {
  checkCurrentCollections,
  cleanupLegacyCollections
} from '@/lib/account-service';

const VALID_TABS = ['overall', 'detailed', 'system'];

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { medias, isLoading, refetchMedias } = useMedias();

  const activeTab = VALID_TABS.includes(searchParams.get('tab') || '') 
    ? searchParams.get('tab')! 
    : 'overall';

  const [newMediaName, setNewMediaName] = useState('');

  // For Edit Dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaConfig | null>(null);
  const [updatedMediaName, setUpdatedMediaName] = useState('');

  // For Delete Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<MediaConfig | null>(null);

  // For Cleanup
  const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
  const [legacyCollections, setLegacyCollections] = useState<string[]>([]);
  const [collectionStatus, setCollectionStatus] = useState<{
    current: Array<{name: string, count: number}>,
    legacy: Array<{name: string, count: number}>
  } | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const handleAddMedia = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMediaName.trim()) {
      toast.warning('メディア名を入力してください。');
      return;
    }

    try {
      await createMedia({ name: newMediaName.trim() });
      toast.success(`「${newMediaName.trim()}」を追加しました。`);
      setNewMediaName('');
      refetchMedias(); // Context経由でリストを再読み込み
    } catch {
      toast.error('メディアの追加に失敗しました。');
    }
  };

  const handleEditMedia = async () => {
    if (!editingMedia || !updatedMediaName.trim()) {
      toast.warning('メディア名を入力してください。');
      return;
    }

    try {
      await updateMedia(editingMedia.id, { name: updatedMediaName.trim() });
      toast.success(`「${updatedMediaName.trim()}」に更新しました。`);
      setIsEditDialogOpen(false);
      setEditingMedia(null);
      refetchMedias(); // Context経由でリストを再読み込み
    } catch {
      toast.error('メディアの更新に失敗しました。');
    }
  };

  const handleDeleteMedia = async () => {
    if (!deletingMedia) return;

    try {
      await deleteMedia(deletingMedia.id);
      toast.success(`「${deletingMedia.name}」を削除しました。`);
      setIsDeleteDialogOpen(false);
      setDeletingMedia(null);
      refetchMedias(); // Context経由でリストを再読み込み
    } catch {
      toast.error('メディアの削除に失敗しました。');
    }
  };

  const openEditDialog = (media: MediaConfig) => {
    setEditingMedia(media);
    setUpdatedMediaName(media.name);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (media: MediaConfig) => {
    setDeletingMedia(media);
    setIsDeleteDialogOpen(true);
  };

  // Legacy collection cleanup
  const checkAndShowCleanupDialog = async () => {
    setIsChecking(true);
    try {
      const status = await checkCurrentCollections();
      setCollectionStatus(status);
      const legacyNames = status.legacy.map(l => l.name);
      setLegacyCollections(legacyNames);

      if (status.legacy.length === 0) {
        toast.success('不要なコレクションは見つかりませんでした');
        console.log('現在のコレクション状況:', status.current);
        return;
      }

      setIsCleanupDialogOpen(true);
    } catch (error) {
      console.error('Error checking legacy collections:', error);
      toast.error('コレクションの確認中にエラーが発生しました');
    } finally {
      setIsChecking(false);
    }
  };

  const handleCleanup = async () => {
    setIsCleaningUp(true);
    try {
      await cleanupLegacyCollections();
      toast.success('不要なコレクションを削除しました');
      setIsCleanupDialogOpen(false);
      setLegacyCollections([]);
    } catch (error) {
      console.error('Error during cleanup:', error);
      toast.error('クリーンアップ中にエラーが発生しました');
    } finally {
      setIsCleaningUp(false);
    }
  };

  return (
    <div className="space-y-6">

      {activeTab === 'overall' && (
        <div className="space-y-6">
          {/* メディア設定 */}
          <Card>
            <CardHeader>
              <CardTitle>メディア設定</CardTitle>
              <CardDescription>新しいメディアの追加や、既存メディアの管理を行います。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddMedia} className="flex items-center gap-2 mb-6">
                <Input
                  placeholder="新しいメディア名" 
                  value={newMediaName}
                  onChange={(e) => setNewMediaName(e.target.value)}
                  className="max-w-xs"
                />
                <Button type="submit">メディアを追加</Button>
              </form>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>メディア名</TableHead>
                      <TableHead className="w-[120px] text-right">アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ) : medias.length > 0 ? (
                      medias.map((media) => (
                        <TableRow key={media.id}>
                          <TableCell className="font-medium">{media.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(media)} className="mr-2">
                              編集
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(media)}>
                              削除
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center">
                          メディアが登録されていません。
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>会計期間設定</CardTitle>
              <CardDescription>
                会計年度の開始月や期数を設定します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                ※ 会計期間設定機能は準備中です
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ユーザー管理</CardTitle>
              <CardDescription>
                システムにアクセスできるユーザーと権限を管理します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                ※ ユーザー管理機能は準備中です
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'detailed' && (
        <div className="space-y-6">
          {/* 勘定項目設定 */}
          <AccountItemManager />

          <Card>
            <CardHeader>
              <CardTitle>ASP管理</CardTitle>
              <CardDescription>
                データ連携対象のASPを管理します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                ※ ASP管理機能は準備中です
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Firebase データクリーンアップ */}
          <FirebaseCleanup />

          {/* データベースクリーンアップ */}
          <Card>
            <CardHeader>
              <CardTitle>データベースクリーンアップ</CardTitle>
              <CardDescription>
                古いコレクションや不要なデータを削除します。システムが重くなった場合に実行してください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={checkAndShowCleanupDialog}
                  disabled={isChecking}
                  className="bg-yellow-50 border-yellow-200 hover:bg-yellow-100 text-yellow-800"
                >
                  {isChecking ? 'チェック中...' : '不要なデータを確認・削除'}
                </Button>

                {collectionStatus && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium mb-2">コレクション状況</h4>
                    <div className="space-y-2 text-xs">
                      <div>
                        <strong>現在使用中:</strong>
                        <ul className="ml-4 mt-1">
                          {collectionStatus.current.map(col => (
                            <li key={col.name} className="text-green-700">
                              {col.name}: {col.count}件
                            </li>
                          ))}
                        </ul>
                      </div>
                      {collectionStatus.legacy.length > 0 && (
                        <div>
                          <strong className="text-red-600">不要なコレクション:</strong>
                          <ul className="ml-4 mt-1">
                            {collectionStatus.legacy.map(col => (
                              <li key={col.name} className="text-red-600">
                                {col.name}: {col.count}件
                            </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MCPステータス監視</CardTitle>
              <CardDescription>
                実績データ自動収集の実行状況を確認します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                ※ MCP監視機能は準備中です
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>通知設定</CardTitle>
              <CardDescription>
                エラー発生時やシステム更新時の通知設定を管理します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                ※ 通知設定機能は準備中です
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メディア名を編集</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={updatedMediaName}
              onChange={(e) => setUpdatedMediaName(e.target.value)}
              placeholder="新しいメディア名"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleEditMedia}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              メディア「{deletingMedia?.name}」を削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMedia}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cleanup Confirmation Dialog */}
      <AlertDialog open={isCleanupDialogOpen} onOpenChange={setIsCleanupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>不要なデータの削除</AlertDialogTitle>
            <AlertDialogDescription>
              以下の古いコレクションが見つかりました。削除しますか？
              <br />
              <br />
              <strong>削除対象:</strong>
              <ul className="list-disc ml-4 mt-2">
                {collectionStatus?.legacy.map(col => (
                  <li key={col.name} className="text-red-600">
                    <strong>{col.name}</strong> ({col.count}件のドキュメント)
                  </li>
                )) || legacyCollections.map(collection => (
                  <li key={collection}>{collection}</li>
                ))}
              </ul>
              <br />
              <span className="text-red-600">※この操作は元に戻せません。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaningUp}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanup}
              disabled={isCleaningUp}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCleaningUp ? '削除中...' : '削除実行'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SettingsPageContent />
    </Suspense>
  );
}
