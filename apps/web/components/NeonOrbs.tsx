/* Decorative animated radial-gradient orbs. Pure CSS, respects
   prefers-reduced-motion via the global rule in globals.css. */

interface NeonOrbsProps {
  className?: string;
}

export function NeonOrbs({ className = '' }: NeonOrbsProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <span className="orb orb-a" />
      <span className="orb orb-b" />
      <span className="orb orb-c" />
      <style>{`
        .orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(72px);
          opacity: 0.55;
          will-change: transform;
        }
        .orb-a {
          top: -8%;
          left: -10%;
          width: 38vmax;
          height: 38vmax;
          background: radial-gradient(circle at 30% 30%, var(--brand) 0%, transparent 65%);
          animation: orbDriftA 22s ease-in-out infinite alternate;
        }
        .orb-b {
          bottom: -12%;
          right: -8%;
          width: 42vmax;
          height: 42vmax;
          background: radial-gradient(circle at 70% 70%, var(--accent) 0%, transparent 65%);
          animation: orbDriftB 28s ease-in-out infinite alternate;
        }
        .orb-c {
          top: 35%;
          left: 50%;
          width: 28vmax;
          height: 28vmax;
          background: radial-gradient(circle, var(--glow) 0%, transparent 60%);
          opacity: 0.32;
          animation: orbDriftC 34s ease-in-out infinite alternate;
        }
        @keyframes orbDriftA {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(6vmax, 4vmax) scale(1.1); }
        }
        @keyframes orbDriftB {
          from { transform: translate(0, 0) scale(1); }
          to { transform: translate(-5vmax, -6vmax) scale(1.08); }
        }
        @keyframes orbDriftC {
          from { transform: translate(-50%, -50%) scale(1); }
          to { transform: translate(-58%, -42%) scale(1.15); }
        }
      `}</style>
    </div>
  );
}
