'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { YouTubeVideo } from '@/lib/youtube/types';

const LAST_SINGER_KEY = 'lastSingerName';
const TOAST_TIMEOUT_MS = 2500;

interface UseRequesterDialogOptions {
  addSongToQueue: (video: YouTubeVideo, requesterName?: string | null) => void;
  updateRequesterName: (queueId: string, name: string | null) => void;
  // When false, adds skip the dialog entirely and go straight to the queue
  // (the host has explicitly disabled the singer-name prompt).
  requesterPromptEnabled: boolean;
}

// State machine for the "+ Add" → requester dialog → toast flow plus the
// edit-existing-requester path. Encapsulates pendingAdd / editingQueueId,
// the dialog open/mode/key derivations, and the post-add toast (with
// auto-dismiss timer + unmount cleanup).
export function useRequesterDialog({
  addSongToQueue,
  updateRequesterName,
  requesterPromptEnabled,
}: UseRequesterDialogOptions) {
  // Pending video while the requester dialog is open. Capturing the target
  // here means the dialog stays decoupled from the search panel — the panel
  // just fires `onAdd(video)` like before.
  const [pendingAdd, setPendingAdd] = useState<YouTubeVideo | null>(null);
  // Edit mode keys off a queue item; null when we're in add mode.
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [dialogInitialName, setDialogInitialName] = useState('');
  const [toastSong, setToastSong] = useState<YouTubeVideo | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const fireToast = useCallback((song: YouTubeVideo) => {
    setToastSong(song);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastSong(null), TOAST_TIMEOUT_MS);
  }, []);

  const dismissToast = useCallback(() => {
    setToastSong(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const rememberSinger = useCallback((name: string) => {
    try {
      localStorage.setItem(LAST_SINGER_KEY, name);
    } catch {}
  }, []);

  const handleAddToQueue = useCallback(
    (video: YouTubeVideo) => {
      // Honor the room-wide setting: when the prompt is off, skip the dialog
      // and add the song straight to the queue (no requester attached). The
      // toast still fires so the user gets feedback.
      if (!requesterPromptEnabled) {
        addSongToQueue(video);
        fireToast(video);
        return;
      }
      setPendingAdd(video);
      setEditingQueueId(null);
      // Each "Add" opens with an empty input — multiple users share one device,
      // so prefilling with the previous singer would make them backspace every
      // time. Edit mode still shows the song's current requester (below).
      setDialogInitialName('');
    },
    [requesterPromptEnabled, addSongToQueue, fireToast],
  );

  const handleEditRequester = useCallback(
    (item: { queueId: string; requesterName?: string }) => {
      setPendingAdd(null);
      setEditingQueueId(item.queueId);
      setDialogInitialName(item.requesterName ?? '');
    },
    [],
  );

  const closeRequesterDialog = useCallback(() => {
    setPendingAdd(null);
    setEditingQueueId(null);
  }, []);

  const handleRequesterConfirm = useCallback(
    (name: string | null) => {
      if (pendingAdd) {
        const video = pendingAdd;
        addSongToQueue(video, name);
        if (name) rememberSinger(name);
        fireToast(video);
      } else if (editingQueueId) {
        updateRequesterName(editingQueueId, name);
        if (name) rememberSinger(name);
      }
      closeRequesterDialog();
    },
    [
      pendingAdd,
      editingQueueId,
      addSongToQueue,
      updateRequesterName,
      rememberSinger,
      fireToast,
      closeRequesterDialog,
    ],
  );

  const dialogOpen = pendingAdd !== null || editingQueueId !== null;
  const dialogMode: 'add' | 'edit' = pendingAdd ? 'add' : 'edit';
  // Tying the key to the current target remounts the dialog each time we open
  // it for a different song. Guarantees stale local state (a half-typed name
  // from a previous open) can't survive into the next session.
  const dialogKey = pendingAdd
    ? `add-${pendingAdd.id}`
    : editingQueueId
      ? `edit-${editingQueueId}`
      : 'closed';

  return {
    handleAddToQueue,
    handleEditRequester,
    handleRequesterConfirm,
    closeRequesterDialog,
    dialogOpen,
    dialogMode,
    dialogKey,
    dialogInitialName,
    toastSong,
    dismissToast,
  };
}
