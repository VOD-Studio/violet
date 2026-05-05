// 分片上传逻辑封装
// 对接后端 /api/v1/upload/* 分片上传接口
// 支持大文件分片上传、断点续传、秒传检测

import { api } from "@/lib/api";

/** 分片大小：5MB */
const CHUNK_SIZE = 5 * 1024 * 1024;

/** 上传结果 */
interface UploadResult {
  /** 文件相对路径，需用 getUploadUrl() 拼接完整 URL */
  url: string;
  /** 缩略图相对路径（可选） */
  thumbnail?: string;
  /** 文件记录 ID */
  id: string;
  /** 原始文件名 */
  name: string;
  /** MIME 类型 */
  mimeType: string;
  /** 图片宽度（仅图片类型） */
  width?: number;
  /** 图片高度（仅图片类型） */
  height?: number;
}

/** 初始化上传会话响应（含秒传和断点续传） */
interface InitSessionResponse {
  /** 是否秒传命中 */
  instant: boolean;
  /** 秒传文件 ID */
  fileId?: string;
  /** 秒传文件 URL */
  url?: string;
  /** 上传会话 ID */
  uploadId?: string;
  /** 分片大小（字节） */
  chunkSize: number;
  /** 总分片数 */
  totalChunks: number;
  /** 断点续传已上传的分片索引 */
  uploadedChunks: number[];
}

/** 合并上传响应 */
interface MergeResultResponse {
  /** 文件记录 ID */
  fileId: string;
  /** 文件访问地址 */
  url: string;
  /** 缩略图地址 */
  thumbnail?: string;
}

/**
 * 计算文件 hash 使用 Web Crypto API
 * 通过读取文件头部和尾部数据生成指纹
 */
export async function computeFileHash(file: File): Promise<string> {
  const sampleSize = 64 * 1024;
  const chunks: ArrayBuffer[] = [];

  // 读取文件头部
  const headSlice = file.slice(0, sampleSize);
  chunks.push(await headSlice.arrayBuffer());

  // 读取文件尾部
  if (file.size > sampleSize) {
    const tailSlice = file.slice(file.size - sampleSize);
    chunks.push(await tailSlice.arrayBuffer());
  }

  // 加上文件大小信息
  const sizeEncoder = new TextEncoder();
  chunks.push(sizeEncoder.encode(`size:${file.size}`).buffer);

  // 合并数据计算 hash
  const totalLength = chunks.reduce((acc, buf) => acc + buf.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", merged);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 将文件切分为分片
 */
function createChunks(file: File): Blob[] {
  const chunks: Blob[] = [];
  let start = 0;
  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    chunks.push(file.slice(start, end));
    start = end;
  }
  return chunks;
}

/**
 * 保存已上传分片记录到 localStorage
 */
function saveUploadedChunks(fileHash: string, chunks: number[]): void {
  localStorage.setItem(`upload_${fileHash}`, JSON.stringify(chunks));
}

/**
 * 清除已上传分片记录
 */
function clearUploadState(fileHash: string): void {
  localStorage.removeItem(`upload_${fileHash}`);
}

/**
 * 分片上传文件
 *
 * 流程：
 * 1. 计算文件 hash
 * 2. 调用 /upload/init（含秒传检查 + 断点续传恢复）
 * 3. 如秒传命中，直接返回
 * 4. 逐片上传分片 PUT /upload/{uploadId}/chunk/{index}
 * 5. 调用 /upload/{uploadId}/complete 合并分片
 *
 * @param file - 文件对象
 * @param onProgress - 进度回调，参数为 0-100 的百分比
 * @returns 上传结果
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
  purpose?: string,
): Promise<UploadResult> {
  const fileHash = await computeFileHash(file);

  // 初始化上传会话（含秒传检查 + 断点续传恢复）
  const initResult = await api.post<InitSessionResponse>("/upload/init", {
    fileName: file.name,
    fileSize: file.size,
    fileHash,
    mimeType: file.type || "application/octet-stream",
    chunkSize: CHUNK_SIZE,
    purpose: purpose || "material",
  });

  // 秒传命中，直接返回
  if (initResult.instant && initResult.url) {
    onProgress?.(100);
    clearUploadState(fileHash);
    return {
      url: initResult.url,
      id: initResult.fileId ?? "",
      name: file.name,
      mimeType: file.type || "application/octet-stream",
    };
  }

  const uploadId = initResult.uploadId!;
  const totalChunks = initResult.totalChunks;

  // 断点续传：使用服务端返回的已上传分片列表
  const serverUploaded = initResult.uploadedChunks ?? [];
  let uploadedChunks = [...serverUploaded];

  // 同步到 localStorage（用于页面刷新后恢复）
  if (uploadedChunks.length > 0) {
    saveUploadedChunks(fileHash, uploadedChunks);
  }

  // 创建分片
  const chunks = createChunks(file);

  // 上传每个分片
  for (let i = 0; i < totalChunks; i++) {
    if (uploadedChunks.includes(i)) {
      onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
      continue;
    }

    // PUT /upload/{uploadId}/chunk/{index}，请求体为原始分片数据
    await api.put(`/upload/${uploadId}/chunk/${i}`, chunks[i]);

    uploadedChunks.push(i);
    saveUploadedChunks(fileHash, uploadedChunks);
    onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
  }

  // 合并所有分片
  const result = await api.post<MergeResultResponse>(
    `/upload/${uploadId}/complete`,
  );

  // 清除断点续传状态
  clearUploadState(fileHash);

  return {
    url: result.url,
    thumbnail: result.thumbnail,
    id: result.fileId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
  };
}

/**
 * 从视频文件截取一帧作为封面缩略图
 * 使用 canvas 绘制视频帧并导出为 JPEG blob
 */
export async function captureVideoThumbnail(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      };
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("视频加载失败"));
      setTimeout(() => reject(new Error("视频加载超时")), 10000);
      video.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 上传视频封面缩略图
 * 上传成功后调用后台接口将缩略图关联到媒体记录
 */
export async function uploadVideoThumbnail(
  mediaId: string,
  file: File,
  thumbnail: Blob,
): Promise<void> {
  const formData = new FormData();
  const thumbName = file.name.replace(/\.[^.]+$/, "") + "_thumb.jpg";
  formData.append("thumbnail", thumbnail, thumbName);

  await api.post(`/media/${mediaId}/thumbnail`, formData);
}

/** 导出类型 */
export type { UploadResult };
export { CHUNK_SIZE };
