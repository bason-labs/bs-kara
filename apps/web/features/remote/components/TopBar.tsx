interface TopBarProps {
  roomCode: string;
}

// "Phòng" is a brand term — hardcoded per spec (rooms.code key does not exist in locale files).
export function TopBar({ roomCode }: TopBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      {/* Left — BS Kara wordmark */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-[10px] bg-gradient-brand shadow-glow flex items-center justify-center text-white text-[13px] font-bold">
          BS
        </div>
        <span className="font-[family-name:var(--font-display)] text-[20px] font-semibold text-fg">
          Kara
        </span>
      </div>

      {/* Right — Room code chip */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface border border-border rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
        <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">
          Phòng
        </span>
        <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-fg">
          {roomCode}
        </span>
      </div>
    </div>
  );
}
