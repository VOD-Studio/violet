/**
 * getDisplayName - 取展示名，空时回退 username
 *
 * display_name 可空（用户未设置），此时展示 username。
 * 所有「显示用户名」的地方都应走此函数，而非直接读 user.username，
 * 确保拆分后展示逻辑统一（Discord/GitHub 模式）。
 *
 * 兼容 UserDTO（display_name 必填）与 AvatarUser（display_name 可选）。
 *
 * @param user 用户对象，含 username 与可选 display_name
 * @returns display_name 非空则返回 display_name，否则回退 username
 */
export const getDisplayName = (user: { username: string; display_name?: string }): string =>
	user.display_name?.trim() || user.username;
