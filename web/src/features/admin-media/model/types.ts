/**
 * admin-media 模块类型定义
 *
 * 后台媒体管理的查询参数与写操作请求体。领域读模型 MediaFile、MediaType 见 entities/media。
 */
import type { MediaType } from "@entities/media/model/types";

/**
 * AdminMediaListQuery - 管理端素材列表查询参数
 *
 * 对接 GET /admin/media，支持多维筛选。
 */
export interface AdminMediaListQuery {
    /** 页码，默认 1 */
    page?: number;
    /** 每页条数，默认 20 */
    limit?: number;
    /** 用途筛选 */
    purpose?: string;
    /** MIME 类型筛选，image/video/audio/file */
    type?: MediaType | string;
    /** 自定义分类筛选 */
    category?: string;
    /** 关键词搜索，文件名 */
    keyword?: string;
}

/**
 * UpdateMediaRequest - 更新素材元数据请求体
 *
 * 对接 PATCH /admin/media/{id}，所有字段可选。
 */
export interface UpdateMediaRequest {
    /** 替代文本/描述 */
    alt_text?: string;
    /** 自定义分类 */
    category?: string;
    /** 重命名，空则不变 */
    original_name?: string;
}
