'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getMedias, MediaConfig, migrateDataStructure } from '@/lib/media-service';
import { migrateAccountItemsToMediaId } from '@/lib/account-service';
import { toast } from 'sonner';

interface MediaContextType {
  medias: MediaConfig[];
  isLoading: boolean;
  refetchMedias: () => Promise<void>;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export function MediaProvider({ children }: { children: ReactNode }) {
  const [medias, setMedias] = useState<MediaConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMedias = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedMedias = await getMedias();
      setMedias(fetchedMedias);
    } catch (error) {
      toast.error('メディアの読み込みに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        const migratedV1 = await migrateDataStructure();
        const migratedV2 = await migrateAccountItemsToMediaId();

        if (migratedV1 || migratedV2) {
          toast.info("データ構造の更新が完了しました。2秒後にリロードします。", { duration: 2000 });
          setTimeout(() => window.location.reload(), 2000);
        } else {
          fetchMedias();
        }
      } catch (error) {
        toast.error("データ移行中にエラーが発生しました。");
        fetchMedias(); // Fallback to fetching data anyway
      }
    };
    initialize();
  }, [fetchMedias]);

  const value = {
    medias,
    isLoading,
    refetchMedias: fetchMedias,
  };

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedias() {
  const context = useContext(MediaContext);
  if (context === undefined) {
    throw new Error('useMedias must be used within a MediaProvider');
  }
  return context;
}
