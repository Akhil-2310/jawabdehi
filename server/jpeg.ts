// Removes every metadata segment (EXIF/GPS, XMP, ICC, comments) from a JPEG. The browser already
// re-encodes photos through a canvas; this is the relayer's second line of defence.

export function stripJpegMetadata(input: Uint8Array): Uint8Array | null {
  if (input[0] !== 0xff || input[1] !== 0xd8) return null
  const out: Uint8Array[] = [input.subarray(0, 2)]
  let i = 2
  while (i + 4 <= input.length) {
    if (input[i] !== 0xff) return null
    const marker = input[i + 1]
    // Start of scan: the rest is image data.
    if (marker === 0xda) {
      out.push(input.subarray(i))
      return concat(out)
    }
    const len = (input[i + 2] << 8) | input[i + 3]
    const end = i + 2 + len
    if (end > input.length) return null
    const isAppN = marker >= 0xe1 && marker <= 0xef // keep APP0 (JFIF), drop APP1–APP15
    const isComment = marker === 0xfe
    if (!isAppN && !isComment) out.push(input.subarray(i, end))
    i = end
  }
  return null
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
