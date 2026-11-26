// Krymper en bild i webbläsaren så att den ryms inom serverns gräns (2 MB) innan uppladdning.
// Bilder som redan ryms, och GIF/SVG (animation/vektor), skickas oförändrade.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
// Tillåtna bilagor (servern kontrollerar samma sak, max 5 MB)
export const ATTACHMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx'
const MAX_EDGE = 2560

export async function fitImage(file: File, maxBytes = MAX_IMAGE_BYTES): Promise<File> {
  if (file.size <= maxBytes || !file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    ctx.fillStyle = '#fff' // JPEG saknar transparens
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.85, 0.75, 0.65]) {
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality))
      if (blob && blob.size <= maxBytes) {
        bitmap.close()
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
      }
    }
    scale *= 0.75
  }
  bitmap.close()
  return file
}
