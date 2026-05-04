// 媒体管理类型定义

/** 媒体文件数据结构 */
export interface MediaItem {
  /** 媒体文件唯一标识 */
  id: string;
  /** 存储文件名 */
  filename: string;
  /** 原始文件名 */
  original_name: string;
  /** MIME 类型 */
  mime_type: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件路径 */
  path: string;
  /** 缩略图路径 */
  thumbnail?: string;
  /** 图片宽度 */
  width?: number;
  /** 图片高度 */
  height?: number;
  /** 音视频时长 */
  duration?: number;
  /** 下载次数 */
  download_count: number;
  /** 下载权限 */
  download_permission: string;
  /** 创建时间 */
  created_at: string;
}
