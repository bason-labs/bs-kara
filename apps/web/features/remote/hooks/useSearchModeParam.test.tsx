import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSearchModeParam } from './useSearchModeParam';

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams('room=2048&tab=search&mode=invalid'),
}));

describe('search mode', () => {
  it('defaults to manual and preserves room/tab when switching', () => {
    const { result } = renderHook(() => useSearchModeParam());
    expect(result.current[0]).toBe('manual');
    act(() => result.current[1]('voice'));
    expect(replace).toHaveBeenCalledWith('/?room=2048&tab=search&mode=voice', { scroll: false });
  });
});
