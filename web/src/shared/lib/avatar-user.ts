import { avatarUrl } from "./image-url";

/** 接口返回的头像用户。 */
export interface AvatarUser {
	/** 用户名（唯一登录标识） */
	username: string;
	/** 显示名，空时回退用户名 */
	display_name?: string;
	/** 头像地址，空串表示没有头像 */
	avatar_url: string;
}

/**
 * 把接口用户转成 `@violet/ui` 头像的入参。
 *
 * @remarks 头像经 `avatarUrl` 取 200px 缩略图，避免浏览器解码原图；没有头像时不给 `src`，由首字兜底。
 */
export function toAvatarItem(user: AvatarUser): { name: string; src?: string } {
	return {
		name: user.display_name || user.username,
		src: user.avatar_url ? avatarUrl(user.avatar_url, user.username) : undefined,
	};
}
