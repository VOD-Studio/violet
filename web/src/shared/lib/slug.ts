/**
 * 标题锚点 slug 生成（项目内统一规则）。
 *
 * 用于文章标题 H2/H3/H4 的锚点 id,被四处共用,保证一致:
 * - markdown/render.ts 的 marked 扩展(MD→HTML 渲染时加 id)
 * - markdown-preview/MarkdownContent.tsx 的 rehype plugin(旧 MD 降级渲染)
 * - markdown-preview/HtmlContent.tsx 的 ensureHeadingIds(HTML 补 id)
 * - hooks/use-toc.ts 的 extractToc(提取 TOC)
 *
 * 规则:trim + 小写 + 非 Unicode 字母数字折叠为单连字符 + trim 首尾。
 * 中文/日文/带重音字母等 Unicode 字母保留(与 GitHub slugger 一样支持中文)。
 * 刻意不追求精确复刻 GitHub 的标点删除规则——封闭系统内只要四处一致即可,
 * 标点统一折叠为 - 比删除更直观(不粘连相邻词)。
 */

/** 非字母数字的连续字符(Unicode property escape,含所有标点/符号/空格/emoji) */
const NON_ALNUM = /[^\p{L}\p{N}]+/gu;
/** 连续连字符压缩为单个 */
const MULTI_DASH = /-{2,}/g;
/** 首尾连字符 */
const EDGE_DASH = /^-+|-+$/g;

/**
 * slugify - 文本转 slug(纯函数,不去重)
 *
 * 重复调用同值返回同结果。需要去重用 Slugger 类。
 */
export function slugify(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replace(NON_ALNUM, "-")
		.replace(MULTI_DASH, "-")
		.replace(EDGE_DASH, "");
}

/**
 * Slugger - 带去重的 slug 生成器
 *
 * 追踪已生成的 slug,重复时追加 -1/-2/-3… 直到唯一。
 * 一篇文章的标题提取/渲染应该用同一个实例(确保跨标题去重一致),
 * 不同文章各自 new 新实例。
 */
export class Slugger {
	private occurrences = new Map<string, number>();

	/**
	 * 生成唯一 slug,重复文本自动追加递增序号(-1/-2/-3…)。
	 *
	 * 算法对齐 github-slugger:首次出现的 slug 直接用;重复时让原 slug
	 * 的计数自增、拼成 base-N,直到找到未被占用的 result。
	 */
	slug(text: string): string {
		const base = slugify(text);
		let result = base;
		while (this.occurrences.has(result)) {
			const count = (this.occurrences.get(base) ?? 0) + 1;
			this.occurrences.set(base, count);
			result = `${base}-${count}`;
		}
		this.occurrences.set(result, 0);
		return result;
	}

	/** 重置,忘记所有已生成的 slug */
	reset(): void {
		this.occurrences.clear();
	}
}
