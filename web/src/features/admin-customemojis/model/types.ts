/** admin-customemojis feature 的后端 DTO（对应 application/customemoji 的 Admin 读模型）。 */

/** AdminCustomEmojiOwner - 上传者只读视图 */
export interface AdminCustomEmojiOwner {
	id: string;
	username: string;
	/** 展示名，可能为空串，展示时回退 username */
	display_name: string;
	/** 头像地址，可能为空串 */
	avatar_url: string;
}

/** AdminCustomEmoji - 后台自定义表情列表项 */
export interface AdminCustomEmoji {
	id: string;
	name: string;
	url: string;
	owner: AdminCustomEmojiOwner;
	created_at: string;
}
