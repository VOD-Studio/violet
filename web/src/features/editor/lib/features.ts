/**
 * features - 编辑器能力开关的单一真相源
 *
 * 调用方通过 disabledFeatures 声明禁用项（黑名单语义，缺省全量启用），
 * resolveFeatures 把名单派生成布尔能力集；扩展注册、工具栏、斜杠菜单、
 * 底部状态栏均从同一份能力集过滤，保证「一处声明、处处一致」。
 *
 * 粒度约定：只把「真实出现过两种场景需求」的功能建开关（文章全量 /
 * 笔记裁剪），不为想象中的需求预建 flag。
 */

/** 可裁剪的编辑器能力 id */
export type EditorFeature =
	| "color"
	| "align"
	| "underline"
	| "table"
	| "imageLibrary"
	| "importFile"
	| "exportFile";

/** 派生后的能力集；新增 EditorFeature 时补字段可在编译期暴露遗漏的消费点 */
export interface ResolvedFeatures {
	color: boolean;
	align: boolean;
	underline: boolean;
	table: boolean;
	imageLibrary: boolean;
	importFile: boolean;
	exportFile: boolean;
}

export function resolveFeatures(disabled?: readonly EditorFeature[]): ResolvedFeatures {
	const set = new Set(disabled);
	return {
		color: !set.has("color"),
		align: !set.has("align"),
		underline: !set.has("underline"),
		table: !set.has("table"),
		imageLibrary: !set.has("imageLibrary"),
		importFile: !set.has("importFile"),
		exportFile: !set.has("exportFile"),
	};
}
