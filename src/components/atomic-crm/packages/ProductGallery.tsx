import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

import type { Package } from "../types";

/** The product's pictures: a large one and a row of thumbnails to choose from. */
export const ProductGallery = ({
  pkg,
}: {
  pkg: Pick<Package, "images" | "image_url" | "title">;
}) => {
  const images = pkg.images?.length
    ? pkg.images
    : pkg.image_url
      ? [{ url: pkg.image_url }]
      : [];
  const [selected, setSelected] = useState(0);
  const current = images[Math.min(selected, images.length - 1)];

  if (!current) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-xl bg-muted text-muted-foreground">
        <ImageOff className="size-10" aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
        <img
          src={current.url}
          alt={current.alt || pkg.title}
          className="size-full object-contain"
        />
      </div>
      {images.length > 1 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Pictures"
        >
          {images.map((image, i) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`Picture ${i + 1} of ${images.length}`}
              aria-pressed={i === selected}
              className={cn(
                "size-16 overflow-hidden rounded-md bg-muted ring-offset-background",
                i === selected
                  ? "ring-2 ring-primary ring-offset-2"
                  : "opacity-70 hover:opacity-100",
              )}
            >
              <img
                src={image.url}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
