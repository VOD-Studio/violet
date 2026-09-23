/** 聊天 Bot 凭据读模型 */
export interface BotDTO {
	id: string;
	/** 对应虚拟用户 ID：消息 sender.id 即此值 */
	user_id: string;
	/** @提及与私聊寻址用的用户名 */
	username: string;
	name: string;
	avatar_id?: string;
	avatar_url?: string;
	enabled: boolean;
	show_thinking: boolean;
	thinking_default_expanded: boolean;
	/** 明文 token，仅创建、重置与「查看凭据」响应携带 */
	token?: string;
	/** 当前能否取回明文；false = 库里无可用密文，只能重置 token */
	token_viewable: boolean;
	created_at: string;
	updated_at: string;
}

/** 注册 Bot 请求。username 需满足 3-32 位字母、数字、下划线或连字符 */
export interface CreateBotRequest {
	name: string;
	username: string;
	/** 素材库图片 ID；省略表示不设头像，换头像走 PATCH 的 avatar_id */
	avatar_id?: string;
}

/** 改名 / 启停。avatar_id 传空串清除头像，缺省表示不改 */
export interface UpdateBotRequest {
	name?: string;
	avatar_id?: string;
	enabled?: boolean;
	show_thinking?: boolean;
	thinking_default_expanded?: boolean;
}
