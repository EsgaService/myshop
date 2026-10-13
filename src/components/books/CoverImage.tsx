"use client";

import { useState } from "react";

/**
 * Absolutely positioned cover image with a dark gradient for text contrast.
 * Renders nothing when the image fails, so the branded placeholder behind it shows instead of a broken image.
 * `onFail` lets the parent adapt its text color to the placeholder.
 */
export function CoverImage({ src, onFail }: { src: string; onFail?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          setFailed(true);
          onFail?.();
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
    </>
  );
}
