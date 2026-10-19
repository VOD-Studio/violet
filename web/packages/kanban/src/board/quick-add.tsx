import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { formatMessage } from "../locale.ts";
import type { BoardMessages } from "./messages.ts";

export interface QuickAddProps {
	/** 所在列的标题，用于输入框的可访问名称。 */
	columnTitle: string;
	messages: BoardMessages;
	/** 提交一个标题；拒绝或抛错表示保存失败。 */
	onSubmit(title: string): void | Promise<void>;
	/** 保存失败时调用，`title` 是提交的标题；表单已经关掉时也会调用。 */
	onError?(error: unknown, title: string): void;
	/** 打开表单时调用。 */
	onOpen?(): void;
}

/**
 * 列底快速添加：先是一个按钮，点开后只填标题。
 *
 * 保存成功后清空并保持打开，方便连续添加；失败时保留已输入的标题。
 */
export function QuickAdd({ columnTitle, messages, onSubmit, onError, onOpen }: QuickAddProps) {
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState("");
	const [pending, setPending] = useState(false);
	const [failed, setFailed] = useState(false);
	const pendingRef = useRef(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const openerRef = useRef<HTMLButtonElement>(null);
	const restoreFocus = useRef(false);
	/** 每次打开、关闭换一个编号，保存的结果回来时据此丢掉过期的。 */
	const session = useRef(0);

	useEffect(() => {
		if (open) inputRef.current?.focus();
		else if (restoreFocus.current) openerRef.current?.focus();
		restoreFocus.current = false;
	}, [open]);

	const close = (refocus: boolean) => {
		restoreFocus.current = refocus;
		session.current += 1;
		pendingRef.current = false;
		setPending(false);
		setOpen(false);
		setValue("");
		setFailed(false);
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		const title = value.trim();
		if (!title || pendingRef.current) return;
		const mine = session.current;
		pendingRef.current = true;
		setPending(true);
		try {
			await onSubmit(title);
			if (session.current === mine) {
				setValue("");
				setFailed(false);
			}
		} catch (error) {
			// 表单在保存期间关掉了：错误仍要报告，但不能留在下一次打开的表单上
			if (session.current === mine) setFailed(true);
			onError?.(error, title);
		} finally {
			if (session.current === mine) {
				pendingRef.current = false;
				setPending(false);
			}
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Escape") return;
		// 只关闭表单：不让 Esc 继续去退出全屏或取消别的操作
		event.preventDefault();
		event.stopPropagation();
		close(true);
	};

	if (!open) {
		return (
			<button
				ref={openerRef}
				type="button"
				className="v-kanban__add"
				onClick={() => {
					onOpen?.();
					setOpen(true);
				}}
			>
				{messages.addCard}
			</button>
		);
	}
	return (
		<form className="v-kanban__add-form" onSubmit={submit}>
			<input
				ref={inputRef}
				type="text"
				className="v-kanban__add-input"
				value={value}
				placeholder={messages.addCardPlaceholder}
				aria-label={formatMessage(messages.addCardLabel, { column: columnTitle })}
				aria-invalid={failed || undefined}
				aria-busy={pending || undefined}
				readOnly={pending}
				onChange={(event) => {
					setValue(event.target.value);
					setFailed(false);
				}}
				onKeyDown={onKeyDown}
				onBlur={(event) => {
					const next = event.relatedTarget as Node | null;
					if (
						pendingRef.current ||
						value.trim() ||
						event.currentTarget.form?.contains(next)
					)
						return;
					close(false);
				}}
			/>
			<div className="v-kanban__add-actions">
				<button
					type="submit"
					className="v-kanban__add-submit"
					aria-disabled={pending || undefined}
				>
					{messages.addCardSubmit}
				</button>
				<button type="button" className="v-kanban__add-cancel" onClick={() => close(true)}>
					{messages.addCardCancel}
				</button>
			</div>
			{failed ? (
				<p role="alert" className="v-kanban__add-error">
					{messages.addCardFailed}
				</p>
			) : null}
		</form>
	);
}
