'use client';

interface BackdropLayersProps {
  // YouTube videoId for the currently-playing track. When present, its
  // maxres thumbnail becomes the ambient blur background. When absent, no
  // image is set and the dark overlay still covers everything.
  videoId?: string | null;
}

// Two stacked absolute layers: a blurred YouTube thumbnail and a dark
// dimmer over it. Sits behind the rest of the TV layout (everything else
// renders at z-10+).
export function BackdropLayers({ videoId }: BackdropLayersProps) {
  const bgImageUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : '';
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-110 blur-[100px] opacity-60 transition-all duration-1000"
        style={{ backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : 'none' }}
      />
      <div className="absolute inset-0 bg-black/60" />
    </div>
  );
}
