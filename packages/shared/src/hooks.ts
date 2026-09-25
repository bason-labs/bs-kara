'use client';

export { default as i18n } from './lib/i18n';

export { useRoom } from './hooks/useRoom';
export type { RoomState } from './hooks/useRoom/types';
export { useTransientNotice } from './hooks/useTransientNotice';
export { useMCPlayer } from './hooks/useMCPlayer';
export type { MCVoice, UseMCPlayerArgs, UseMCPlayerResult } from './hooks/useMCPlayer';
