/**
 * Client-side image compression utility.
 * Resizes images to a max dimension and converts to WebP (with JPEG fallback).
 * Typically reduces file size by 60-80%.
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** If set, output canvas will be forced to this width/height ratio (width / height). */
  targetAspectRatio?: number;
  /** How to fit the source into the target frame when targetAspectRatio is set. Default 'contain'. */
  fit?: 'cover' | 'contain';
}

const DEFAULT_OPTIONS = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.8,
};

/**
 * Compress an image File, returning a new Blob (WebP if supported, else JPEG).
 */
export async function compressImage(
  file: File,
  options?: CompressOptions
): Promise<{ blob: Blob; extension: string }> {
  const { maxWidth, maxHeight, quality, targetAspectRatio, fit } = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const srcW = img.width;
      const srcH = img.height;

      let canvasW: number;
      let canvasH: number;
      let drawX = 0;
      let drawY = 0;
      let drawW: number;
      let drawH: number;

      if (targetAspectRatio && targetAspectRatio > 0) {
        // Force output canvas to the target aspect ratio, sized to fit within maxWidth/maxHeight.
        let outW = maxWidth;
        let outH = Math.round(outW / targetAspectRatio);
        if (outH > maxHeight) {
          outH = maxHeight;
          outW = Math.round(outH * targetAspectRatio);
        }
        canvasW = outW;
        canvasH = outH;

        const srcRatio = srcW / srcH;
        const dstRatio = targetAspectRatio;

        if (fit === 'contain') {
          if (srcRatio > dstRatio) {
            drawW = canvasW;
            drawH = Math.round(canvasW / srcRatio);
          } else {
            drawH = canvasH;
            drawW = Math.round(canvasH * srcRatio);
          }
          drawX = Math.round((canvasW - drawW) / 2);
          drawY = Math.round((canvasH - drawH) / 2);
        } else {
          // cover: fill entire canvas, cropping overflow
          if (srcRatio > dstRatio) {
            drawH = canvasH;
            drawW = Math.round(canvasH * srcRatio);
          } else {
            drawW = canvasW;
            drawH = Math.round(canvasW / srcRatio);
          }
          drawX = Math.round((canvasW - drawW) / 2);
          drawY = Math.round((canvasH - drawH) / 2);
        }
      } else {
        // Legacy behavior: preserve aspect, only scale down.
        let width = srcW;
        let height = srcH;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvasW = width;
        canvasH = height;
        drawW = width;
        drawH = height;
      }

      const canvas = document.createElement("canvas");
      canvas.width = canvasW;
      canvas.height = canvasH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // White background (avoids black bars for contain fit; harmless for cover)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Try WebP first, fall back to JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, extension: "webp" });
          } else {
            // Fallback to JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) {
                  resolve({ blob: jpegBlob, extension: "jpg" });
                } else {
                  reject(new Error("Failed to compress image"));
                }
              },
              "image/jpeg",
              quality
            );
          }
        },
        "image/webp",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}
