/**
 * SlashCommand - 斜杠命令扩展
 *
 * 注册一个 Suggestion 插件：输入 / 时唤起命令菜单（SlashMenuView）。
 * 菜单项由调用方注入（buildSlashItems），渲染用 createRoot 手动挂载，
 * 并交给 suggestion 的 props.mount 接管定位（Floating UI）。
 */
import { Extension } from "@tiptap/core";
import { Suggestion, type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";
import { SlashMenuView } from "./SlashMenu";
import type { SlashMenuItem } from "./slash-items";

export interface SlashCommandOptions {
	/** 图片插入回调 */
	onPickImage: () => void;
	/** 构造菜单项（注入 onPickImage） */
	items: (onPickImage: () => void) => SlashMenuItem[];
}

/** 渲染器内部状态：宿主节点 + React Root + 卸载函数 */
interface RendererState {
	host: HTMLDivElement;
	root: Root;
	unmount?: () => void;
	/** 最近一次渲染的 props，供键盘事件复用 */
	last: SuggestionProps<SlashMenuItem> | null;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
	name: "slashCommand",

	addOptions() {
		return {
			onPickImage: () => {},
			items: () => [],
		};
	},

	addProseMirrorPlugins() {
		const options = this.options;

		return [
			Suggestion<SlashMenuItem>({
				editor: this.editor,
				char: "/",
				startOfLine: false,
				allowedPrefixes: [" ", ""],
				items: ({ query }): SlashMenuItem[] => {
					const all = options.items(options.onPickImage);
					const q = query.toLowerCase().trim();
					if (!q) return all;
					return all.filter(
						(it) =>
							it.title.toLowerCase().includes(q) ||
							it.id.toLowerCase().includes(q) ||
							it.keywords.some((k) => k.toLowerCase().includes(q)),
					);
				},
				command: ({ editor, range, props }) => {
					// 先删除触发的 / 及 query，再执行项命令
					editor.chain().focus().deleteRange(range).run();
					props.command(editor);
				},
				render: () => {
					let state: RendererState | null = null;

					const mount = (props: SuggestionProps<SlashMenuItem>) => {
						const host = document.createElement("div");
						host.className = "slash-menu-host";
						// managed mount 把 host 挂到 document.body 且不设 z-index；
						// Zen 专注根容器是 fixed inset-0 z-40，不设层级菜单会被整体遮挡
						host.style.zIndex = "50";
						const root = createRoot(host);
						root.render(<SlashMenuView {...props} />);
						const unmount = props.mount?.(host) ?? undefined;
						state = { host, root, unmount, last: props };
					};

					const update = (props: SuggestionProps<SlashMenuItem>) => {
						if (!state) {
							mount(props);
							return;
						}
						state.root.render(<SlashMenuView {...props} />);
						state.last = props;
					};

					return {
						onStart: (props) => mount(props),
						onUpdate: (props) => update(props),
						onExit: () => {
							state?.unmount?.();
							state?.root.unmount();
							state = null;
						},
						onKeyDown: (props: SuggestionKeyDownProps): boolean => {
							const key = props.event.key;
							// 方向键/回车/Escape 由菜单视图（全局监听）处理，
							// 这里返回 true 阻止编辑器接管，避免光标移动关闭菜单。
							return (
								key === "ArrowUp" ||
								key === "ArrowDown" ||
								key === "Enter" ||
								key === "Escape"
							);
						},
					};
				},
			}),
		];
	},
});
