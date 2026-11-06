import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "../button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../dialog";
import { Input } from "../input";
import { Label } from "../label";
import { Textarea } from "../textarea";

/** 只要一个值的确认：重命名、新建标签、插入链接。 */
export interface PromptDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	description?: ReactNode;
	/** 输入框的可见标签；省略时以标题为输入框命名 */
	label?: string;
	/** 打开时预填并全选 */
	defaultValue?: string;
	placeholder?: string;
	/** 最多字数；给出时在输入框下方显示字数 */
	maxLength?: number;
	/** 多行输入；回车换行，⌘↵ 或 Ctrl ↵ 提交 */
	multiline?: boolean;
	/** @default "保存" */
	confirmLabel?: string;
	/**
	 * 提交输入框内容；返回 false 时保留对话框与输入，其余返回值（含 void）视为通过并关闭。
	 */
	// biome-ignore lint/suspicious/noConfusingVoidType: 现有回调多数返回 void
	onConfirm: (value: string) => boolean | void;
	/** 写在输入框下方的错误，如空值、重名 */
	error?: string;
	/** 输入变化，供调用方清掉 error */
	onValueChange?: (value: string) => void;
	/** 挂载 Portal 的容器；默认 `document.body` */
	container?: HTMLElement | null;
}

/** 输入确认框：确认框的外壳放一个输入框，出场同对话框；Esc、点遮罩与「取消」等价，错误写在输入框下方。 */
export function PromptDialog({
	open,
	onOpenChange,
	title,
	description,
	label,
	defaultValue = "",
	placeholder,
	maxLength,
	multiline = false,
	confirmLabel = "保存",
	onConfirm,
	error,
	onValueChange,
	container,
}: PromptDialogProps) {
	const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
	const [value, setValue] = useState(defaultValue);
	const titleId = useId();
	const fieldId = useId();
	const errorId = useId();

	useEffect(() => {
		if (open) setValue(defaultValue);
	}, [open, defaultValue]);

	const update = (next: string) => {
		setValue(next);
		onValueChange?.(next);
	};

	const submit = () => {
		if (onConfirm(value) === false) return;
		onOpenChange(false);
	};

	const invalid = Boolean(error);
	const fieldProps = {
		id: fieldId,
		value,
		placeholder,
		maxLength,
		"aria-labelledby": label ? undefined : titleId,
		"aria-invalid": invalid || undefined,
		"aria-describedby": invalid ? errorId : undefined,
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				data-slot="prompt-dialog"
				className="v-confirm"
				showCloseButton={false}
				container={container}
				aria-labelledby={titleId}
				onOpenAutoFocus={(event) => {
					const field = fieldRef.current;
					if (!field) return;
					event.preventDefault();
					field.focus({ preventScroll: true });
					field.select();
				}}
				{...(description ? {} : { "aria-describedby": undefined })}
			>
				<DialogTitle id={titleId} className="v-confirm__title">
					{title}
				</DialogTitle>
				{description && (
					<DialogDescription className="v-confirm__description">
						{description}
					</DialogDescription>
				)}
				<div className="v-prompt__field">
					{label && <Label htmlFor={fieldId}>{label}</Label>}
					{multiline ? (
						<Textarea
							ref={fieldRef}
							rows={6}
							{...fieldProps}
							onChange={(event) => update(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
									event.preventDefault();
									submit();
								}
							}}
						/>
					) : (
						<Input
							ref={fieldRef}
							{...fieldProps}
							invalid={invalid}
							onChange={(event) => update(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.nativeEvent.isComposing) {
									event.preventDefault();
									submit();
								}
							}}
						/>
					)}
					{(invalid || maxLength !== undefined) && (
						<div className="v-prompt__meta">
							{invalid && (
								<span id={errorId} className="v-prompt__error">
									{error}
								</span>
							)}
							{maxLength !== undefined && (
								<span className="v-prompt__count">
									{value.length} / {maxLength}
								</span>
							)}
						</div>
					)}
				</div>
				<div className="v-confirm__actions v-prompt__actions">
					{!multiline && <span className="v-prompt__hint">回车{confirmLabel}</span>}
					<DialogClose asChild>
						<Button variant="secondary">取消</Button>
					</DialogClose>
					<Button onClick={submit}>{confirmLabel}</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
