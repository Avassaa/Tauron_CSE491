import { uploadCommentImage } from "~/lib/api-client"

/** Mirrors composer attachments (defined here to avoid circular imports). */
export interface CommentImagePayload {
  id: string
  fileName: string
  fileType: "image" | "document"
  thumbnailUrl?: string
}

export const EMPTY_COMPOSER_ATTACHMENTS: CommentImagePayload[] = []

const MD_IMAGE_RE = /!\[[^\]]*\]\((data:image\/[^)]*|https?:\/\/[^)]+)\)/g

export function buildCommentMarkdownBody(message: string, attachments: CommentImagePayload[]): string {
  const chunks: string[] = []
  const t = message.trim()
  if (t.length > 0) chunks.push(t)
  for (const att of attachments) {
    if (att.fileType === "image" && att.thumbnailUrl) {
      chunks.push(`![](${att.thumbnailUrl})`)
    }
  }
  return chunks.join("\n\n")
}

export async function resolveCommentAttachmentsToUrls(
  attachments: CommentImagePayload[],
): Promise<CommentImagePayload[]> {
  const out: CommentImagePayload[] = []
  for (const att of attachments) {
    const src = att.thumbnailUrl
    if (!src?.startsWith("data:image/")) {
      out.push(att)
      continue
    }
    const blob = await fetch(src).then((r) => r.blob())
    const file = new File([blob], att.fileName || "image.jpg", {
      type: blob.type || "image/jpeg",
    })
    const url = await uploadCommentImage(file)
    out.push({ ...att, thumbnailUrl: url })
  }
  return out
}

export function parseCommentMarkdownForEdit(raw: string): {
  text: string
  attachments: CommentImagePayload[]
} {
  const attachments: CommentImagePayload[] = []
  let i = 0
  const cleaned = raw.replace(MD_IMAGE_RE, (_full, url: string) => {
    attachments.push({
      id: `existing-${i++}`,
      fileName: `image-${i}.png`,
      fileType: "image",
      thumbnailUrl: url,
    })
    return ""
  })
  return { text: cleaned.replace(/\n{3,}/g, "\n\n").trim(), attachments }
}

export async function compressImageFileToDataUrl(
  file: File,
  maxSide = 1400,
  jpegQuality = 0.82,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image")
  }
  if (file.type === "image/gif") {
    return readFileAsDataUrl(file)
  }

  const dataUrl = await readFileAsDataUrl(file)
  if (file.size < 512_000 && (file.type === "image/png" || file.type === "image/webp")) {
    return dataUrl
  }

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("Image failed to load"))
    img.src = dataUrl
  })

  const w = img.naturalWidth
  const h = img.naturalHeight
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)

  const canvas = document.createElement("canvas")
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext("2d")
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, cw, ch)

  const useJpeg = file.type !== "image/png"
  if (useJpeg) {
    return canvas.toDataURL("image/jpeg", jpegQuality)
  }
  return canvas.toDataURL("image/png")
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error("Read failed"))
    r.readAsDataURL(file)
  })
}
