// Client-side image helper. Reads a user-selected file, downscales it to a
// square headshot, and returns a compressed JPEG data URL. Keeps stored
// avatars small (~tens of KB) so member rows and RSC payloads stay lean.

/** Read an image File and return a center-cropped square JPEG data URL,
 *  at most `size`×`size` pixels. Runs in the browser (uses canvas). */
export function readImageAsResizedDataUrl(file: File, size = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Not an image file"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unsupported"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        reject(err as Error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}
