"use client";

import { useState } from "react";
import { CoverImage } from "./CoverImage";

type BookCardCoverProps = {
  title: string;
  coverUrl: string | null;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
};

/** Card header: cover image with the title over a gradient, or the branded placeholder (also when the image fails). */
export function BookCardCover({ title, coverUrl, primaryColor, backgroundColor, textColor }: BookCardCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(coverUrl) && !failed;
  return (
    <div
      className="relative flex h-36 flex-col justify-end overflow-hidden p-5"
      style={{ background: backgroundColor, color: textColor, borderBottom: `5px solid ${primaryColor}` }}
    >
      {showImage && coverUrl && <CoverImage src={coverUrl} onFail={() => setFailed(true)} />}
      <p
        className="relative font-display text-xl font-semibold leading-tight"
        style={showImage ? { color: "#fff" } : { color: primaryColor }}
      >
        {title}
      </p>
    </div>
  );
}
