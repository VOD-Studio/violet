/** 公开用户资料的缓存键，供资料设置与公开主页共用。 */
export const userKeys = {
	profile: (username: string) => ["users", "profile", username] as const,
};
