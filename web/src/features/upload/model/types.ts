/**
 * upload 模块类型定义
 *
 * 对接后端分片上传三步接口：初始化、上传分片、合并。
 * 头像场景按单分片处理，整文件作为一个 chunk。
 *
 * 字段来源：application/media/service.go 的 InitUploadSession 与 Merge 结果，
 * 已带 json tag，snake_case。
 */

/**
 * InitUploadRequest - 初始化上传会话请求体
 *
 * 对应后端 handler media.initUploadSession 的请求结构，
 * 字段命名 camelCase 与后端 json tag 一致。
 */
export interface InitUploadRequest {
	/** 文件名，必填 */
	fileName: string;
	/** 文件字节数，必填 */
	fileSize: number;
	/** 文件 SHA-256 哈希，命中则秒传 */
	fileHash: string;
	/** MIME 类型，如 image/png */
	mimeType: string;
	/** 单分片大小，头像场景取 fileSize */
	chunkSize: number;
	/** 用途标识，头像场景为 avatar */
	purpose: string;
}

/**
 * InitSessionResult - 初始化上传会话响应
 *
 * instant 为 true 时秒传命中，直接使用 url 无需再传分片；
 * 否则用 upload_id 逐片上传后合并。
 */
export interface InitSessionResult {
	/** 是否秒传命中 */
	instant: boolean;
	/** 秒传命中时复用的已存在文件 ID */
	file_id?: string;
	/** 秒传命中时复用的文件访问 URL */
	url?: string;
	/** 新建或续传会话 ID */
	upload_id?: string;
	/** 单分片大小 */
	chunk_size: number;
	/** 总分片数，头像场景为 1 */
	total_chunks: number;
	/** 已上传分片索引，续传时非空 */
	uploaded_chunks: number[];
}

/**
 * MergeResult - 合并分片完成上传响应
 *
 * 对应后端 Merge 结果，返回最终文件信息。
 */
export interface MergeResult {
	/** 文件 ID */
	file_id: string;
	/** 文件访问 URL */
	url: string;
	/** 缩略图 URL，图片类文件存在 */
	thumbnail?: string;
	/** 图片宽度，像素 */
	width?: number;
	/** 图片高度，像素 */
	height?: number;
}
