// Photo cleaning in the browser: redrawing onto a canvas drops all metadata (GPS, phone model,
// time), and the resident can tap to pixelate faces, number plates or anything identifying.

const MAX_SIDE = 1280

export async function loadToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/** Pixelates a square around (x, y), in canvas pixels. */
export function pixelate(canvas: HTMLCanvasElement, x: number, y: number) {
  const ctx = canvas.getContext("2d")!
  const size = Math.round(Math.max(canvas.width, canvas.height) * 0.09)
  const block = Math.max(6, Math.round(size / 6))
  const x0 = Math.max(0, Math.round(x - size / 2))
  const y0 = Math.max(0, Math.round(y - size / 2))
  const w = Math.min(size, canvas.width - x0)
  const h = Math.min(size, canvas.height - y0)
  const img = ctx.getImageData(x0, y0, w, h)
  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      const i = (by * w + bx) * 4
      ctx.fillStyle = `rgb(${img.data[i]},${img.data[i + 1]},${img.data[i + 2]})`
      ctx.fillRect(x0 + bx, y0 + by, Math.min(block, w - bx), Math.min(block, h - by))
    }
  }
}

export async function uploadCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the photo"))), "image/jpeg", 0.82),
  )
  const res = await fetch("/api/photo", { method: "POST", body: blob })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Upload failed")
  return body.hash as string
}

export const photoUrl = (hash: string) => `/photos/${hash.slice(2)}.jpg`
