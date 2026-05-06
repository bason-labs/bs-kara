'use client';

import { useRoomSubscribe } from './subscribe';
import { useRoomMC } from './mc';
import { useRoomQueue } from './queue';
import { useRoomHistory } from './history';
import { useRoomSettings } from './settings';

export type { RoomState } from './types';

// Composes the per-concern sub-hooks into the single public hook. Field
// order on the returned object is kept identical to the pre-split version
// so that any caller relying on object-iteration order (or test snapshots)
// stays unaffected.
export function useRoom(roomId: string | null) {
  const { roomData, isLoading, roomExists, roomDataRef } =
    useRoomSubscribe(roomId);
  const { generateMCForQueueItem, tryClaimAnnouncementLock } =
    useRoomMC(roomId);
  const queue = useRoomQueue(roomId, roomDataRef, generateMCForQueueItem);
  const { addToPlayedHistory } = useRoomHistory(roomId, roomDataRef);
  const settings = useRoomSettings(roomId, roomDataRef);

  return {
    roomData,
    isLoading,
    roomExists,
    addSongToQueue: queue.addSongToQueue,
    updateRequesterName: queue.updateRequesterName,
    removeSong: queue.removeSong,
    reorderQueue: queue.reorderQueue,
    togglePlayPause: queue.togglePlayPause,
    setIsPlaying: queue.setIsPlaying,
    playNext: queue.playNext,
    playPrevious: queue.playPrevious,
    sendEmoji: settings.sendEmoji,
    resetRoom: settings.resetRoom,
    setAutoRandomMode: settings.setAutoRandomMode,
    setRandomFilters: settings.setRandomFilters,
    addToPlayedHistory,
    setDragDropEnabled: settings.setDragDropEnabled,
    setRequesterPromptEnabled: settings.setRequesterPromptEnabled,
    setMCEnabled: settings.setMCEnabled,
    setMcVoice: settings.setMcVoice,
    tryClaimAnnouncementLock,
    removeCurrentPlaying: queue.removeCurrentPlaying,
    setCurrentPlayingDirectly: queue.setCurrentPlayingDirectly,
    playSongNow: queue.playSongNow,
  };
}
