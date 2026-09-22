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
	/** 明文 token，仅创建与重置响应返回一次 */
	token?: string;
	created_at: string;
	updated_at: string;
}

/** 注册 Bot 请求。username 需满足 3-32 位字母、数字、下划线或连字符 */
export interface CreateBotRequest {
	name: string;
	username: string;
}

/** 改名 / 启停。avatar_id 传空串清除头像，缺省表示不改 */
export interface UpdateBotRequest {
	name?: string;
	avatar_id?: string;
	enabled?: boolean;
}
