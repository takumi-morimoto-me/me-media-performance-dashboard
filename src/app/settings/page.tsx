'use client';

import { useState, FormEvent } from 'react';
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
import {
  checkLegacyCollections,
  cleanupLegacyCollections
} from '@/lib/account-service';

export default function SettingsPage() {
  const { medias, isLoading, refetchMedias } = useMedias();
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
  const [isCleaningUp, setIsCleaningUp] = useState(false);

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
    try {
      const collections = await checkLegacyCollections();
      setLegacyCollections(collections);

      if (collections.length === 0) {
        toast.success('不要なコレクションは見つかりませんでした');
        return;
      }

      setIsCleanupDialogOpen(true);
    } catch (error) {
      console.error('Error checking legacy collections:', error);
      toast.error('コレクションの確認中にエラーが発生しました');
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
      {/* 勘定項目設定 */}
      <AccountItemManager />

      {/* データベースクリーンアップ */}
      <Card>
        <CardHeader>
          <CardTitle>データベースクリーンアップ</CardTitle>
          <CardDescription>
            古いコレクションや不要なデータを削除します。システムが重くなった場合に実行してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={checkAndShowCleanupDialog}
            className="bg-yellow-50 border-yellow-200 hover:bg-yellow-100 text-yellow-800"
          >
            不要なデータを確認・削除
          </Button>
        </CardContent>
      </Card>

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
                {legacyCollections.map(collection => (
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