// 分片上传逻辑封装
// 支持大文件分片上传、断点续传、秒传检测

import { api } from "@/lib/api"

/** 分片大小：5MB */
const CHUNK_SIZE = 5 * 1024 * 1024

/** 上传结果 */
interface UploadResult {
  url: string
  id: string
  name: string
}

/** 初始化上传响应 */
interface InitUploadResponse {
  upload_id: string
  total_chunks: number
}

/** 秒传检查响应 */
interface CheckExistResponse {
  exists: boolean
  media_id?: string
  url?: string
}

/** 合并上传响应 */
interface CompleteUploadResponse {
  media_id: string
  url: string
}

/**
 * 计算文件 hash 使用 Web Crypto API
 * 通过读取文件头部和尾部数据生成指纹
 */
export async function computeFileHash(file: File): Promise<string> {
  const sampleSize = 64 * 1024
  const chunks: ArrayBuffer[] = []

  // 读取文件头部
  const headSlice = file.slice(0, sampleSize)
  chunks.push(await headSlice.arrayBuffer())

  // 读取文件尾部
  if (file.size > sampleSize) {
    const tailSlice = file.slice(file.size - sampleSize)
    chunks.push(await tailSlice.arrayBuffer())
  }

  // 加上文件大小信息
  const sizeEncoder = new TextEncoder()
  chunks.push(sizeEncoder.encode(`size:${file.size}`).buffer)

  // 合并数据计算 hash
  const totalLength = chunks.reduce((acc, buf) => acc + buf.byteLength, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk), offset)
    offset += chunk.byteLength
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", merged)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * 将文件切分为分片
 */
function createChunks(file: File): Blob[] {
  const chunks: Blob[] = []
  let start = 0
  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size)
    chunks.push(file.slice(start, end))
    start = end
  }
  return chunks
}

/**
 * 从 localStorage 获取已上传分片记录
 */
function getUploadedChunks(fileHash: string): number[] {
  try {
    const stored = localStorage.getItem(`upload_${fileHash}`)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * 保存已上传分片记录到 localStorage
 */
function saveUploadedChunks(fileHash: string, chunks: number[]): void {
  localStorage.setItem(`upload_${fileHash}`, JSON.stringify(chunks))
}

/**
 * 清除已上传分片记录
 */
function clearUploadState(fileHash: string): void {
  localStorage.removeItem(`upload_${fileHash}`)
}

/**
 * 分片上传文件
 * @param file - 文件对象
 * @param onProgress - 进度回调，参数为 0-100 的百分比
 * @returns 上传结果
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadResult> {
  const fileHash = await computeFileHash(file)

  // 秒传检查
  const checkResult = await api.post<CheckExistResponse>("/upload/check", {
    file_hash: fileHash,
  })

  if (checkResult.exists && checkResult.url) {
    onProgress?.(100)
    clearUploadState(fileHash)
    return {
      url: checkResult.url,
      id: checkResult.media_id ?? "",
      name: file.name,
    }
  }

  // 初始化上传，获取 upload_id
  const initResult = await api.post<InitUploadResponse>("/upload/init", {
    filename: file.name,
    total_size: file.size,
    chunk_size: CHUNK_SIZE,
    file_hash: fileHash,
  })

  const { upload_id, total_chunks } = initResult

  // 创建分片
  const chunks = createChunks(file)

  // 获取断点续传状态
  let uploadedChunks = getUploadedChunks(fileHash)

  // 上传每个分片
  for (let i = 0; i < total_chunks; i++) {
    if (uploadedChunks.includes(i)) {
      onProgress?.(Math.round(((i + 1) / total_chunks) * 100))
      continue
    }

    const formData = new FormData()
    formData.append("chunk", chunks[i])
    formData.append("upload_id", upload_id)
    formData.append("chunk_index", String(i))
    formData.append("total_chunks", String(total_chunks))
    formData.append("file_hash", fileHash)
    formData.append("filename", file.name)
    formData.append("mime_type", file.type || "application/octet-stream")
    formData.append("total_chunks", String(total_chunks))

    await api.post<{ message: string }>("/upload/chunk", formData)

    uploadedChunks.push(i)
    saveUploadedChunks(fileHash, uploadedChunks)
    onProgress?.(Math.round(((i + 1) / total_chunks) * 100))
  }

  // 合并分片
  const result = await api.post<CompleteUploadResponse>("/upload/complete", {
    upload_id,
  })

  // 清除断点续传状态
  clearUploadState(fileHash)

  return {
    url: result.url,
    id: result.media_id,
    name: file.name,
  }
}

/** 导出类型 */
export type { UploadResult }
export { CHUNK_SIZE }
