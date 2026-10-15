// Phone photos are often 3–8 MB, and over mobile data that is slow and can pass the
// 5 MB limit. A photo larger than LONG_SIDE px (or 1.5 MB) is redrawn at most
// LONG_SIDE px on its long side as a JPEG; small ones are sent as they are.
// Browsers apply the photo's own rotation (EXIF) when drawing it.
const LONG_SIDE = 1600;
const KEEP_BYTES = 1.5 * 1024 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be opened as a photo.')); };
    img.src = url;
  });
}

export async function shrinkPhoto(file) {
  const img = await loadImage(file);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= LONG_SIDE && file.size <= KEEP_BYTES) return file;
  const scale = Math.min(1, LONG_SIDE / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // a PNG's see-through parts become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
