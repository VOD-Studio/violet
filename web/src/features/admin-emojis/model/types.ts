import type { EmojiMeta } from "@entities/emoji/model/types";

/**
 * admin-emojis 模块类型定义
 *
 * 后台表情管理的写操作请求体与批量结果。领域读模型 Emoji、EmojiGroup、EmojiUploadResult 见 entities/emoji。
 */

/**
 * CreateEmojiGroupRequest - 创建表情分组请求体
 *
 * name 必填，source 省略时后端回填 system，is_enabled 省略时默认 true。
 */
export interface CreateEmojiGroupRequest {
	/** 分组名称，必填，同仓内唯一 */
	name: string;
	/** 分组来源，省略时后端回填 system */
	source?: string;
	/** 分组封面图 URL */
	cover_url?: string;
	/** 排序值，默认 0 */
	sort_order?: number;
	/** 是否启用，省略时默认 true，显式传 false 可创建为禁用 */
	is_enabled?: boolean;
	/** 分组类型：1=文字（颜文字组）2=图片（缺省 2） */
	type?: number;
	/** 分组元数据，size 为组内表情默认尺寸（1=小 2=大） */
	meta?: EmojiMeta;
}

/**
 * UpdateEmojiGroupRequest - 更新表情分组请求体
 *
 * sort_order 与 is_enabled 为指针字段，传值才更新，省略保持原值。
 * name 与 source 为零值跳过，空串不覆盖原值。
 */
export interface UpdateEmojiGroupRequest {
	/** 分组名称，空串表示不更新 */
	name?: string;
	/** 分组来源，空串表示不更新 */
	source?: string;
	/** 分组封面图 URL，空串表示不更新 */
	cover_url?: string;
	/** 排序值，传值才更新 */
	sort_order?: number;
	/** 是否启用，传值才更新 */
	is_enabled?: boolean;
	/** 分组类型：1=文字（颜文字组）2=图片，省略不更新 */
	type?: number;
	/** 分组元数据，省略不更新；size 为组内表情默认尺寸（1=小 2=大） */
	meta?: EmojiMeta;
}

/**
 * BatchUpdateGroupStatusRequest - 批量启用/禁用分组请求体
 *
 * ids 至少一项，is_enabled 控制目标状态，返回 affected 更新条数。
 */
export interface BatchUpdateGroupStatusRequest {
	/** 待更新的分组 ID 列表，至少一项 */
	ids: number[];
	/** 目标启用状态，true 启用 false 禁用 */
	is_enabled: boolean;
}

/**
 * CreateEmojiRequest - 在分组内创建表情请求体
 *
 * name 必填，url/gif_url/source_url/text_content 可选，sort_order 默认 0。
 */
export interface CreateEmojiRequest {
	/** 表情名称，必填 */
	name: string;
	/** 静态图片 URL，通常来自 UploadEmoji 的返回 */
	url?: string;
	/** 文本兜底内容，纯文字表情用 */
	text_content?: string;
	/** 动图 URL */
	gif_url?: string;
	/** 来源页 URL */
	source_url?: string;
	/** 分组内排序值，默认 0 */
	sort_order?: number;
	/** 表情元数据（alias/size/type），可选 */
	meta?: EmojiMeta;
}

/**
 * UpdateEmojiRequest - 更新表情请求体
 *
 * 后端用零值判断跳过，空串不会清空 name/url 等字段。
 */
export interface UpdateEmojiRequest {
	/** 表情名称 */
	name?: string;
	/** 静态图片 URL */
	url?: string;
	/** 文本兜底内容 */
	text_content?: string;
	/** 动图 URL */
	gif_url?: string;
	/** 来源页 URL */
	source_url?: string;
	/** 分组内排序值 */
	sort_order?: number;
	/** 表情元数据（alias/size/type），省略时不更新，显式传空对象清空 meta */
	meta?: EmojiMeta;
}

/** CreateResourceResult - 创建资源返回的新 ID */
export interface CreateResourceResult {
	/** 新建资源 ID */
	id: number;
}

/** BatchUpdateResult - 批量操作返回的受影响条数 */
export interface BatchUpdateResult {
	/** 受影响的记录条数 */
	affected: number;
}

/** B站表情重新拉取任务状态 */
export interface RefetchStatus {
	state: "idle" | "running" | "done" | "failed";
	started_at?: string;
	finished_at?: string;
	groups_done: number;
	groups_total: number;
	error?: string;
}
