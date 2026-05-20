'use client';

import { useEffect, useState } from 'react';
import type { YouTubeVideo } from '@/lib/youtube/types';
import { searchYouTube } from '@/lib/youtube/client';
import { DEFAULT_HOT_HITS_QUERY } from '@/lib/config';

// Fetches the initial "Hot Hits" list shown when SearchPanel mounts. Errors
// (network/abort during back nav) are swallowed so isLoading still settles
// — otherwise the panel would be stuck on skeletons forever.
export function useHotHits() {
  const [hotHits, setHotHits] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { videos } = await searchYouTube(DEFAULT_HOT_HITS_QUERY);
        if (!cancelled) setHotHits(videos);
      } catch {
        // intentional swallow — see header comment
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { hotHits, isLoading };
}
