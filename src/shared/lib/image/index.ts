/**
 * Подготовка фото перед загрузкой. См. 04-security.md §5.
 *
 * Зачем: снимок кухни содержит GPS-координаты квартиры в EXIF.
 * Перерисовка через canvas гарантированно уничтожает все метаданные —
 * это надёжнее любой библиотеки-чистильщика.
 */

const MAX_SIDE = 1200;
const MAX_BYTES = 3 * 1024 * 1024;
const QUALITY = 0.8;

/** Сигнатуры файлов. file.type подделывается, первые байты — нет. */
const SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

export async function detectMime(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  for (const { mime, bytes } of SIGNATURES) {
    if (bytes.every((b, i) => head[i] === b)) return mime;
  }
  return null;
}

export class ImageError extends Error {}

/** Проверяет, уменьшает, снимает EXIF, отдаёт WebP. */
export async function sanitizeImage(file: File): Promise<Blob> {
  if (file.size > MAX_BYTES) {
    throw new ImageError('Файл больше 3 МБ. Выберите другое фото.');
  }
  if (!(await detectMime(file))) {
    throw new ImageError('Это не изображение. Подойдут JPEG, PNG или WebP.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Не удалось обработать изображение.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImageError('Не удалось сохранить изображение.'))),
      'image/webp',
      QUALITY,
    );
  });
}

/** Путь в бакете. Первый сегмент — kitchen_id, на нём строятся политики Storage. */
export const dishImagePath = (kitchenId: string, dishId: string) =>
  `${kitchenId}/${dishId}.webp`;
