/**
 * postcard-helpers - 明信片墙的纯函数工具
 *
 * 单独成文件以便 PostcardWall 与 FriendsSkeleton 共用，
 * 也避免向 friends-lab 模块反向依赖（lab 只读不动）。
 */

/** 取站点 host（去 www. 前缀），用于 mono 域名行 */
export function hostOf(url: string): string {
	try {
		return new URL(url).host.replace(/^www\./, "");
	} catch {
		return url;
	}
}

/** 由 id 派生的确定性微旋转角（明信片墙的错落感，避免随机闪烁） */
export function tiltOf(id: string): number {
	let hash = 0;
	for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
	return ((Math.abs(hash) % 5) - 2) * 0.9;
}
