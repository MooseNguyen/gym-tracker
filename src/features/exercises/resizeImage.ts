/** Side of the square photos the app shows (same as the RepDB files). */
export const PHOTO_SIZE = 320

/** The centred square of a width × height image: what a square thumbnail shows. */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height)
  return { sx: (width - side) / 2, sy: (height - side) / 2, side }
}

/**
 * A picked photo as a small square JPEG, ready to upload (~25 kB instead of a
 * few MB from a phone camera). JPEG, not WebP: Safari's canvas cannot encode
 * WebP and would silently hand back a much larger PNG.
 */
export async function toSquareJpeg(file: File, size = PHOTO_SIZE): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Pick an image file.')
  // 'from-image' applies the EXIF rotation, so phone photos are not sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('This image could not be read. Try a JPEG or PNG.')
  })
  try {
    const { sx, sy, side } = centerSquare(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot resize images.')
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))),
        'image/jpeg',
        0.8,
      ),
    )
  } finally {
    bitmap.close()
  }
}
