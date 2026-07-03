/**
 * upload 模块类型定义
 *
 * 项目级「上传能力」归属地：分片上传链路（初始化 → 分片 → 合并）、秒传检查、
 * 缩略图上传。业务侧的资源管理（如 admin-media 的列表/删除/元数据）依赖本模块的上传能力。
 *
 * 字段来源：application/media/service.go，已带 json tag，snake_case。
 */
import type { MediaFile } from "@entities/media/model/types";

/**
 * InitUploadRequest - 初始化上传会话请求体
 *
 * 对应后端 handler media.initUploadSession 的请求结构。
 * fileHash/mimeType/chunkSize/purpose 均可选，不传时由后端补默认值。
 */
export interface InitUploadRequest {
    /** 文件名，必填，后端据此校验扩展名 */
    fileName: string;
    /** 文件总大小，单位字节，必填 */
    fileSize: number;
    /** 文件 SHA-256 哈希，传则启用秒传或续传恢复 */
    fileHash?: string;
    /** MIME 类型，不传则由扩展名推断 */
    mimeType?: string;
    /** 单分片大小，不传则后端默认 5MB */
    chunkSize?: number;
    /** 用途分类，不传则默认 material */
    purpose?: string;
}

/**
 * InitUploadResult - 初始化上传会话响应
 *
 * 三种形态：
 * - 秒传命中：instant=true，返回 file_id 与 url
 * - 续传恢复：upload_id 对应已有会话，uploaded_chunks 列出已上传分片
 * - 新建会话：upload_id 为新 ID，uploaded_chunks 为空
 */
export interface InitUploadResult {
    /** 是否秒传命中 */
    instant: boolean;
    /** 秒传命中时的文件 ID */
    file_id?: string;
    /** 秒传命中时的可访问 URL */
    url?: string;
    /** 上传会话 ID，秒传命中时省略 */
    upload_id?: string;
    /** 分片大小，单位字节 */
    chunk_size: number;
    /** 总分片数 */
    total_chunks: number;
    /** 已上传分片索引列表，用于断点续传 */
    uploaded_chunks: number[];
}

/**
 * CompleteUploadResult - 合并分片完成上传响应
 *
 * 对应后端 Merge 结果，返回最终文件信息。
 */
export interface CompleteUploadResult {
    /** 文件 ID */
    file_id: string;
    /** 文件访问 URL */
    url: string;
    /** 缩略图 URL，无缩略图为空串 */
    thumbnail?: string;
    /** 图片宽度，非图片为 0 */
    width?: number;
    /** 图片高度，非图片为 0 */
    height?: number;
}

/**
 * InstantCheckQuery - 秒传检查查询参数
 *
 * 对接 GET /uploads/instant，后端 handler 要求 hash 非空。
 */
export interface InstantCheckQuery {
    /** 文件哈希，必填 */
    hash: string;
}

/**
 * InstantCheckResult - 秒传检查结果
 *
 * exists 为 false 时 file 为 null。
 */
export interface InstantCheckResult {
    /** 命中的文件信息，未命中为 null */
    file: MediaFile | null;
    /** 是否命中已存在文件 */
    exists: boolean;
}

/**
 * ThumbnailUploadResult - 缩略图上传结果
 *
 * 对接 POST /uploads/thumbnail，后端返回缩略图可访问 URL。
 */
export interface ThumbnailUploadResult {
    /** 缩略图 URL */
    thumbnail: string;
}

/** 向后兼容别名：旧代码用 MergeResult / InitSessionResult */
export type MergeResult = CompleteUploadResult;
export type InitSessionResult = InitUploadResult;
