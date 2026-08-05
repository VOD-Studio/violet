/**
 * PromptDialog - 通用输入弹窗（替代原生 window.prompt）
 *
 * 单输入框弹窗，支持 label / 默认值 / 多行（textarea）。
 * 确认时回传输入值；取消或关闭传空（调用方可判断）。
 */
import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/base/button";
import { Input } from "@/shared/ui/base/input";
import { Label } from "@/shared/ui/base/label";
import { Textarea } from "@/shared/ui/base/textarea";
import { Modal } from "@/shared/ui/modal";

export interface PromptDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	label?: string;
	/** 默认值 */
	defaultValue?: string;
	placeholder?: string;
	/** 是否多行输入 */
	multiline?: boolean;
	confirmLabel?: string;
	/**
	 * 确认回调，返回值即为输入框内容；空字符串表示清空。
	 * 返回 false 可阻止弹窗关闭（用于表单校验失败时保留输入态），
	 * 其余返回值（含 void）视为通过并关闭弹窗。void 必须保留以兼容现有返回 void 的回调。
	 */
	// biome-ignore lint/suspicious/noConfusingVoidType: 故意保留 void 兼容现有 void 回调
	onConfirm: (value: string) => boolean | void;
	/** 受控错误文案；非空时输入框高亮红色并展示该文案 */
	error?: string;
	/** 输入变化回调；用于父组件清空 error 等受控副作用 */
	onValueChange?: (value: string) => void;
}

export function PromptDialog({
	open,
	onOpenChange,
	title,
	description,
	label,
	defaultValue = "",
	placeholder,
	multiline = false,
	confirmLabel = "确认",
	onConfirm,
	error,
	onValueChange,
}: PromptDialogProps) {
	const [value, setValue] = useState(defaultValue);

	// 每次打开时重置为默认值
	useEffect(() => {
		if (open) setValue(defaultValue);
	}, [open, defaultValue]);

	const update = (next: string) => {
		setValue(next);
		onValueChange?.(next);
	};

	const handleConfirm = () => {
		// onConfirm 返回 false 表示校验未通过，保留弹窗与输入态供用户继续修改
		if (onConfirm(value) === false) return;
		onOpenChange(false);
	};

	const invalid = Boolean(error);

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			description={description}
			size="sm"
			footer={
				<>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button onClick={handleConfirm}>{confirmLabel}</Button>
				</>
			}
		>
			{label ? <Label className="mb-1.5 block">{label}</Label> : null}
			{multiline ? (
				<Textarea
					value={value}
					onChange={(e) => update(e.target.value)}
					placeholder={placeholder}
					rows={6}
					autoFocus
					aria-invalid={invalid}
					className="font-mono text-sm"
				/>
			) : (
				<Input
					value={value}
					onChange={(e) => update(e.target.value)}
					placeholder={placeholder}
					autoFocus
					aria-invalid={invalid}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleConfirm();
					}}
				/>
			)}
			{error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
		</Modal>
	);
}
