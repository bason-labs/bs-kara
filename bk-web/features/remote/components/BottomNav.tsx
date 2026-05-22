'use client';

import { useTranslation } from 'react-i18next';
import { ListMusic, Play, Search, Settings } from 'lucide-react';

export type NavTab = 'search' | 'queue' | 'player' | 'settings';

export interface BottomNavProps {
  activeTab: NavTab;
  queueLength: number;
  isPlaying: boolean;
  onTabChange: (tab: NavTab) => void;
}

function EQAnimation() {
  return (
    <span className="flex items-end gap-[2px] h-5" aria-hidden>
      <span className="w-[3px] bg-current rounded-[1px] animate-eq-bar h-[30%]" />
      <span className="w-[3px] bg-current rounded-[1px] animate-eq-bar-1 h-[80%]" />
      <span className="w-[3px] bg-current rounded-[1px] animate-eq-bar-2 h-[55%]" />
      <span className="w-[3px] bg-current rounded-[1px] animate-eq-bar-3 h-[95%]" />
    </span>
  );
}

export function BottomNav({
  activeTab,
  queueLength,
  isPlaying,
  onTabChange,
}: BottomNavProps) {
  const { t } = useTranslation();

  const tabs: { id: NavTab; label: string }[] = [
    { id: 'search', label: t('tabs.search', 'Tìm bài') },
    { id: 'queue', label: t('tabs.queue', 'Hàng chờ') },
    { id: 'player', label: t('tabs.player', 'Đang phát') },
    { id: 'settings', label: 'Cài đặt' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 grid grid-cols-4 backdrop-blur-xl bg-bg/65 border-t border-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Bottom navigation"
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        const iconWrapClass =
          'w-14 h-7 rounded-full flex items-center justify-center transition-colors duration-200 ' +
          (active ? 'bg-glow/20 text-glow' : 'text-muted');
        const labelClass =
          'text-[10.5px] font-semibold ' + (active ? 'text-fg' : 'text-muted');

        let icon: React.ReactNode;
        if (tab.id === 'player') {
          icon =
            isPlaying && activeTab !== 'player' ? (
              <EQAnimation />
            ) : (
              <Play size={20} aria-hidden />
            );
        } else if (tab.id === 'search') {
          icon = <Search size={20} aria-hidden />;
        } else if (tab.id === 'queue') {
          icon = <ListMusic size={20} aria-hidden />;
        } else {
          icon = <Settings size={20} aria-hidden />;
        }

        const isQueueTab = tab.id === 'queue';

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={
              'flex flex-col items-center gap-1 py-2 cursor-pointer min-h-[44px] ' +
              (isQueueTab ? 'relative' : '')
            }
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            <span className={iconWrapClass}>{icon}</span>
            <span className={labelClass}>{tab.label}</span>
            {isQueueTab && queueLength > 0 && (
              <span
                aria-label={`${queueLength} bài trong hàng chờ`}
                className="absolute -top-0.5 right-2.5 min-w-[18px] h-[18px] rounded-full bg-accent text-[#001a1a] text-[9.5px] font-bold flex items-center justify-center border-2 border-bg"
              >
                {queueLength}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
