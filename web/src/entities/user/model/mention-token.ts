/**
 * @ 提及占位符。
 *
 * 正文里的提及以 `@(username:userID)` 形态存储，与表情 `[name:uuid]`、内联图片
 * `![img:id]` 同属正文内联占位符：userID 段是渲染与通知的唯一依据（用户改名后
 * 旧消息仍指向同一人），username 段供解析不到该用户时兜底成 `@username` 文本。
 */

/** username 段字符集与后端 `usernamePattern` 一致；uuid 段为标准 36 位形态。 */
const MENTION_TOKEN_SOURCE =
	"@\\(([a-zA-Z0-9_-]{3,32}):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\\)";

/**
 * 返回一个新的全局提及占位符正则：捕获组 1 为 username、2 为 userID。
 *
 * 不导出共享实例：`exec` 循环会推进 `lastIndex`，跨模块共用同一个正则对象会互相
 * 污染匹配起点。
 */
export function mentionTokenPattern(): RegExp {
	return new RegExp(MENTION_TOKEN_SOURCE, "g");
}

const HUMANIZE_PATTERN = mentionTokenPattern();

/** 把提及占位符还原为可读的 `@username`，供无 mentions 映射可查的纯文本预览使用。 */
export function humanizeMentionTokens(text: string): string {
	return text.replace(HUMANIZE_PATTERN, (_token, username: string) => `@${username}`);
}
