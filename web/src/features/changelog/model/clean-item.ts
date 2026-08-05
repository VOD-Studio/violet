/** 条目里提取出的 issue/PR 引用 */
export interface ItemRef {
	/** 展示文本，如 `#67` */
	label: string;
	url: string;
}

/** 单条 changelog 条目清洗结果 */
export interface CleanItem {
	/** 模块前缀（diagram/web/deploy…），无则空串 */
	scope: string;
	/** 去除噪音后的描述正文 */
	text: string;
	refs: ItemRef[];
}

// v2.2.1 起 release notes 由 release-please 原生生成，条目形态固定为：
//   **scope:** 描述文字（可选 (T3 [#69](url)) 式引用后缀）
// 清洗目标：issue 引用提取成行尾小链接，任务号 Tn / PRD 号等过程标注剥除，
// scope 拆出供分组。更早的 github 原生旧格式不兼容（维护者决策），走原样兜底。

/** markdown 形态 issue 引用：[#67](https://…) */
const MD_REF = /\[#(\d+)\]\((https?:\/\/[^)]+)\)/g;
/** 空括号（引用被提取后的残留） */
const EMPTY_PAREN = /[(（]\s*[)）]/g;
/** 非嵌套括号内容（中英文括号） */
const PAREN = /[(（]([^()（）]*)[)）]/g;
/** 括号噪音 token：任务号、PRD 号、review/前置 等过程标注 */
const NOISE_TOKEN = /T\d+|PRD-\d+|review|前置|后续/gi;
const NOISE_FILLER = /[\s/、,，·]/g;
/** 加粗 scope：冒号在加粗内（release-please 实际格式）或外，兼容中英文冒号 */
const SCOPE_BOLD = /^\*\*([^*:：]+)[:：]?\*\*[:：]?\s*/;

/**
 * cleanItem - 把 release-please 的 commit 粒度条目清洗成读者视角文本。
 *
 * 条目里混着 markdown 链接与任务号（见文件头注释），直接渲染会挂一整串
 * URL；这里统一提取引用、剥除噪音、拆出 scope 供分组。
 */
export function cleanItem(raw: string): CleanItem {
	const refs: ItemRef[] = [];
	const seen = new Set<string>();

	// 1. markdown 引用整体提取并从正文移除
	let text = raw.replace(MD_REF, (_, n: string, url: string) => {
		const label = `#${n}`;
		if (!seen.has(label)) {
			seen.add(label);
			refs.push({ label, url });
		}
		return "";
	});
	// 2. 纯噪音括号（任务号/review 标注）整颗剥除；描述性括号（如「含 ID 回填」）保留。
	//    空括号兜底（引用提取后的残留）。
	text = text.replace(PAREN, (m, content: string) =>
		content.replace(NOISE_TOKEN, "").replace(NOISE_FILLER, "") === "" ? "" : m,
	);
	text = text.replace(EMPTY_PAREN, "");

	// 3. scope：加粗冒号形态
	let scope = "";
	const m = text.match(SCOPE_BOLD);
	if (m) {
		scope = m[1].trim();
		text = text.slice(m[0].length);
	}

	// 4. 收尾：markdown 残留符号、多余空白、尾部孤立标点
	text = text
		.replace(/\*\*/g, "")
		.replace(/`/g, "")
		.replace(/\s{2,}/g, " ")
		.replace(/[\s,，、;；:：]+$/, "")
		.trim();

	return { scope, text: text || raw, refs };
}

/** 同分类下的渲染分组：scope 为 null 表示散条目组（单例 scope 与无 scope 条目） */
export interface ItemGroup {
	scope: string | null;
	items: CleanItem[];
}

/**
 * groupItems - 同分类条目按 scope 聚合。
 *
 * 只有同 scope 出现 ≥2 次才成组（v2.4.0「新增」7 条里 diagram×5、web×2），
 * 单例 scope 挂前缀反而是噪音，剥掉与无 scope 条目一起平铺。
 * 组按 scope 首次出现排序，散条目组固定在最后。
 */
export function groupItems(items: CleanItem[]): ItemGroup[] {
	const counts = new Map<string, number>();
	for (const it of items) {
		if (it.scope) counts.set(it.scope, (counts.get(it.scope) ?? 0) + 1);
	}
	const groups: ItemGroup[] = [];
	const byScope = new Map<string, ItemGroup>();
	const loose: CleanItem[] = [];
	for (const it of items) {
		if (it.scope && (counts.get(it.scope) ?? 0) >= 2) {
			let g = byScope.get(it.scope);
			if (!g) {
				g = { scope: it.scope, items: [] };
				byScope.set(it.scope, g);
				groups.push(g);
			}
			g.items.push(it);
		} else {
			loose.push(it);
		}
	}
	if (loose.length > 0) groups.push({ scope: null, items: loose });
	return groups;
}
