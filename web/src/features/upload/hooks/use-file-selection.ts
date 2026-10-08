import { matchesAcceptedFile } from "@features/upload/lib/matches-accepted-file";
import { type ComponentPropsWithRef, useCallback, useRef } from "react";
import { toast } from "sonner";

/** 文件选择约束与筛选后回调；不执行上传。 */
export interface UseFileSelectionOptions {
	accept: string;
	/** 单文件大小上限，单位为字节。 */
	maxSize: number;
	/** 每次选择的文件数上限，不累计历史选择。 */
	maxFiles: number;
	onSelect: (files: File[]) => void;
	disabled?: boolean;
}

/** 原生文件输入属性与点击、拖放入口。 */
export interface UseFileSelectionResult {
	inputProps: ComponentPropsWithRef<"input">;
	open: () => void;
	selectFiles: (files: FileList | File[]) => void;
}

/**
 * 筛选原生选择或拖放文件，只将非空有效文件交给调用方。
 *
 * @returns inputProps 挂到按钮之外的 input；open 打开选择器，selectFiles 接收拖放文件。
 */
export function useFileSelection({
	accept,
	maxSize,
	maxFiles,
	onSelect,
	disabled = false,
}: UseFileSelectionOptions): UseFileSelectionResult {
	const inputRef = useRef<HTMLInputElement>(null);

	const selectFiles = useCallback(
		(files: FileList | File[]) => {
			if (disabled) return;

			const all = Array.from(files);
			const accepted = all.filter((file) => matchesAcceptedFile(file, accept));
			if (accepted.length < all.length) {
				toast.warning("部分文件类型不受支持，已自动过滤");
			}
			const valid = accepted.filter((file) => file.size <= maxSize);
			if (valid.length < accepted.length) {
				toast.warning("部分文件超过大小限制，已自动过滤");
			}
			const selected = valid.slice(0, maxFiles);
			if (selected.length > 0) onSelect(selected);
		},
		[accept, maxSize, maxFiles, onSelect, disabled],
	);

	const open = useCallback(() => {
		if (!disabled) inputRef.current?.click();
	}, [disabled]);

	return {
		inputProps: {
			ref: inputRef,
			type: "file",
			accept,
			multiple: maxFiles > 1,
			disabled,
			onChange: (event) => {
				const files = Array.from(event.currentTarget.files ?? []);
				// 先清空原生选择，回调中打开弹层或抛错也不影响同文件重选。
				event.currentTarget.value = "";
				selectFiles(files);
			},
		},
		open,
		selectFiles,
	};
}
