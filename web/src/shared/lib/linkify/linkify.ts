/**
 * linkify - 通用 URL 识别 tokenizer
 *
 * 从纯文本中切出 URL 段：识别 `http(s)://`、`www.` 前缀的链接（裸域名不做，
 * 误判率高），支持中文等 Unicode 路径，尾部标点剥离，超长显示截断。
 *
 * 与后端 `application/tweet/urls.go` 的 ExtractURLs 保持同一规则集
 * （PRD-0038：后端按此提取正文 URL 关联 OG 卡片）。
 */

/** 单个 URL 段：原文起止偏移与展示/跳转地址。 */
export interface LinkifyMatch {
	/** URL 在原文中的起始偏移（含） */
	start: number;
	/** URL 在原文中的结束偏移（不含；已剥离尾部标点） */
	end: number;
	/** 跳转地址：无协议时补 https:// */
	href: string;
	/** 展示文本原文（未截断） */
	text: string;
}

/** URL 主体允许的字符：ASCII URL 保留字 + 非 ASCII（Unicode 路径） */
const URL_BODY = /[\p{L}\p{N}._~:/?#[\]@!$&'()*+,;=%-]/u;
const TRAILING_PUNCT = /[.,;:!?)\]}'"]+$/u;
/** 域名段字符：ASCII 字母数字与连字符 */
const HOST = /[A-Za-z0-9-]/;

const PROTOCOL_RE = /^https?:\/\//i;
const WWW_RE = /^www\./i;

/**
 * 扫描纯文本，返回按出现顺序排列的 URL 段。
 *
 * 识别规则：
 * - `http://`、`https://`（大小写不敏感）或 `www.`（前一个字符不属于 URL 主体，
 *   避免 `awww.example.com` 中段误起）开头
 * - 主机须为 `.` 分隔的至少两段域名段
 * - 路径/query/fragment 宽松延伸到首个非 URL 字符；Unicode 字符属于 URL
 * - 尾部标点（句号、逗号、右括号等）剥离回原文
 *
 * @param text 待扫描纯文本
 * @returns URL 段数组；无链接为空数组
 * @example
 * tokenizeLinks("看这篇 https://example.com/文章/1。") // 句号剥离
 * tokenizeLinks("去 www.example.com 看看") // href 补 https://
 */
export function tokenizeLinks(text: string): LinkifyMatch[] {
	const matches: LinkifyMatch[] = [];
	let i = 0;
	while (i < text.length) {
		const rest = text.slice(i);
		const proto = PROTOCOL_RE.exec(rest);
		const www = !proto && WWW_RE.exec(rest);
		const prev = i > 0 ? text[i - 1] : "";
		let bodyStart: number;
		if (proto) {
			bodyStart = i + proto[0].length;
		} else if (www && (i === 0 || !URL_BODY.test(prev))) {
			bodyStart = i + www[0].length;
		} else {
			i++;
			continue;
		}
		let end = stripTrailing(text, scanBody(text, bodyStart));
		if (end > bodyStart && hasHost(text.slice(bodyStart, end))) {
			const raw = text.slice(i, end);
			const href = PROTOCOL_RE.test(raw) ? raw : `https://${raw}`;
			matches.push({ start: i, end, href, text: raw });
			i = end;
		} else {
			i = bodyStart; // 不是链接，从主体处继续扫描
		}
	}
	return matches;
}

/** 从 from 起扫描 URL 主体（主机+路径），停在首个不属于 URL 主体的字符。 */
function scanBody(text: string, from: number): number {
	let i = from;
	while (i < text.length && URL_BODY.test(text[i])) i++;
	return i;
}

/** 剥离末尾标点后的结束偏移。 */
function stripTrailing(text: string, end: number): number {
	const m = TRAILING_PUNCT.exec(text.slice(0, end));
	return m ? end - m[0].length : end;
}

/** 校验主体存在 `.` 分隔的至少两段非空域名段（首个 `/` 前的部分）。 */
function hasHost(body: string): boolean {
	const host = body.slice(0, body.indexOf("/") === -1 ? undefined : body.indexOf("/"));
	let seg = 0;
	let sawDot = false;
	for (const ch of host) {
		if (ch === ".") {
			if (seg === 0) return false;
			sawDot = true;
			seg = 0;
		} else if (HOST.test(ch)) {
			seg++;
		} else if (sawDot && seg > 0) {
			return true; // 端口等后续字符，主机已完整
		} else {
			return false;
		}
	}
	return sawDot && seg > 0;
}

/** 展示截断阈值：超过则头尾保留、中间省略。 */
const DISPLAY_MAX = 60;
const HEAD = 30;
const TAIL = 20;

/**
 * 超长 URL 的展示形态：头 30 + … + 尾 20；不超长原样返回。
 *
 * @param raw URL 原文
 */
export function displayUrl(raw: string): string {
	if (raw.length <= DISPLAY_MAX) return raw;
	return `${raw.slice(0, HEAD)}…${raw.slice(-TAIL)}`;
}
