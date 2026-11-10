import { resolveLocalization } from "@violetjs/react-tweet";

/**
 * 推文相关的界面文案（引用、嵌套引用、图片灯箱），取自 react-tweet 的 zh-CN 预设。
 *
 * @remarks 站点固定 zh-CN 与 Asia/Shanghai；文案的单一来源留在 react-tweet，站点不另抄一份。
 */
export const TWEET_MESSAGES = resolveLocalization({
	locale: "zh-CN",
	timeZone: "Asia/Shanghai",
}).messages;
