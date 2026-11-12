"use client";

import {
	type CSSProperties,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { type EmojiPreviewGeometry, measureEmojiPreview } from "./emoji-preview-geometry";
import { emojiItemDescription, emojiItemName } from "./emoji-text";
import type { EmojiCell } from "./navigation";

interface Preview extends EmojiPreviewGeometry {
	key: string;
	/** 隐藏后重新出现时只淡入，不从上次坐标移动过来。 */
	entering: boolean;
}

/** 预览控制器的稳定回调可供网格导航直接复用。 */
export interface EmojiPreviewState {
	preview: Preview | null;
	visible: boolean;
	show: (cell: EmojiCell, element: HTMLElement) => void;
	/** 立即隐藏跳过 60ms 离开宽限，但仍保留纸片的淡出。 */
	hide: (immediate?: boolean) => void;
	/** 仅取消离开宽限，不重测坐标或改变可见状态。 */
	keep: () => void;
}

/** 用稳定 key 跟踪实时目录，退出宽限允许指针跨过格子间隙后返回。 */
export function useEmojiPreview(
	root: RefObject<HTMLDivElement | null>,
	viewport: RefObject<HTMLDivElement | null>,
	cellsByKey: ReadonlyMap<string, EmojiCell>,
	optionRefs: ReadonlyMap<string, HTMLElement>,
): EmojiPreviewState {
	const [preview, setPreview] = useState<Preview | null>(null);
	const [visible, setVisible] = useState(false);
	const currentPreview = useRef<Preview | null>(null);
	const currentlyVisible = useRef(false);
	const delay = useRef<number | undefined>(undefined);

	const keep = useCallback(() => {
		window.clearTimeout(delay.current);
		delay.current = undefined;
	}, []);

	const hide = useCallback(
		(immediate = false) => {
			keep();
			if (immediate) {
				currentlyVisible.current = false;
				setVisible(false);
			} else {
				delay.current = window.setTimeout(() => {
					delay.current = undefined;
					currentlyVisible.current = false;
					setVisible(false);
				}, 60);
			}
		},
		[keep],
	);

	const show = useCallback(
		(cell: EmojiCell, element: HTMLElement) => {
			keep();
			if (!root.current || !viewport.current) {
				return;
			}
			const previous = currentPreview.current;
			const entering =
				!currentlyVisible.current || (previous?.key === cell.key && previous.entering);
			const next: Preview = {
				key: cell.key,
				...measureEmojiPreview(root.current, viewport.current, element),
				entering,
			};
			currentPreview.current = next;
			currentlyVisible.current = true;
			setPreview(next);
			setVisible(true);
		},
		[keep, root, viewport],
	);

	useLayoutEffect(() => {
		const previous = currentPreview.current;
		if (!previous || !currentlyVisible.current) {
			return;
		}
		if (!cellsByKey.has(previous.key)) {
			hide(true);
			return;
		}
		if (!root.current || !viewport.current) {
			return;
		}
		const element = optionRefs.get(previous.key);
		if (!element) {
			hide(true);
			return;
		}
		const next: Preview = {
			...previous,
			...measureEmojiPreview(root.current, viewport.current, element),
		};
		currentPreview.current = next;
		setPreview(next);
	}, [cellsByKey, hide, optionRefs, root, viewport]);

	useEffect(() => keep, [keep]);

	return { preview, visible, show, hide, keep };
}

/** 由当前目录解析 cell；缺失项不保留旧内容，也不重复播报选项的名称与描述。 */
export interface EmojiPreviewProps {
	preview: Preview | null;
	cell: EmojiCell | undefined;
	visible: boolean;
}

/** 预览只补充视觉，内容与选项共享同一份可访问名称和描述。 */
export function EmojiPreview({ preview, cell, visible }: EmojiPreviewProps) {
	if (!preview || !cell) {
		return null;
	}
	const { x, y, width, arrow, side, entering } = preview;
	const details = emojiItemDescription(cell.item);
	return (
		<div
			className="v-emoji-picker__preview"
			data-visible={visible}
			data-side={side}
			data-entering={entering}
			aria-hidden="true"
			style={
				{
					left: x,
					top: y,
					width,
					"--v-emoji-preview-arrow": `${arrow}px`,
				} as CSSProperties
			}
		>
			<span className="v-emoji-picker__preview-content" data-density={cell.section.density}>
				{cell.item.content}
			</span>
			<b>{emojiItemName(cell.item)}</b>
			<span className="v-emoji-picker__preview-detail" title={details}>
				{details}
			</span>
			<i className="v-emoji-picker__preview-arrow" />
		</div>
	);
}
