/**
 * admin-media 模块类型定义
 *
 * 后台媒体管理写操作请求体。领域读模型与目录查询见 entities/media。
 */

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
