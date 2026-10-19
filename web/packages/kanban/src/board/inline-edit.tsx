import { type KeyboardEvent, useContext, useEffect, useId, useRef, useState } from "react";
import type { Locale } from "../locale.ts";
import { notifyEditing } from "../pan-region.ts";
import { BoardLocaleContext } from "./locale-context.ts";

/** 内联编辑的文案。 */
export interface InlineEditMessages {
	/**
	 * 保存失败时的提示。
	 * @example "The change couldn't be saved. Try again."
	 */
	saveFailed: string;
	/**
	 * 不允许空文字却提交了空文字时的提示。
	 * @example "This can't be empty."
	 */
	required: string;
}

const messagesByLocale: Record<Locale, InlineEditMessages> = {
	en: {
		saveFailed: "The change couldn't be saved. Try again.",
		required: "This can't be empty.",
	},
	"zh-CN": { saveFailed: "未能保存，请重试", required: "不能为空" },
};

/** `InlineEdit` 的属性。 */
export interface InlineEditProps {
	/** 当前文字。 */
	value: string;
	/**
	 * 保存新文字（已去掉首尾空白）。返回的 Promise 被拒绝或同步抛错表示保存失败：
	 * 留在编辑态、保留已输入的文字并提示。
	 */
	onSave: (value: string) => void | Promise<void>;
	/** 输入框的可访问名称，也作为展示态按钮的说明，例如「卡片标题」。 */
	label: string;
	placeholder?: string;
	maxLength?: number;
	/**
	 * 是否允许保存空文字。
	 * @default false
	 */
	allowEmpty?: boolean;
	className?: string;
	/**
	 * 内置文案的语言。
	 * @default 所在看板的 `locale`，不在看板里时为 `"en"`
	 */
	locale?: Locale;
	/** 覆盖内置文案，只需给出要改的键。 */
	messages?: Partial<InlineEditMessages>;
}

/**
 * 点击文字就地编辑：展示态是按钮，点开变成输入框。
 *
 * Enter 或失去焦点保存，Esc 放弃；没有改动不调用 `onSave`。放在看板卡片里使用，
 * 输入框里的按键和指针不会拿起或拖动卡片。样式沿用看板的变量，所以要在看板（`Board`）里渲染。
 */
export function InlineEdit({
	value,
	onSave,
	label,
	placeholder,
	maxLength,
	allowEmpty = false,
	className,
	locale: localeProp,
	messages: overrides,
}: InlineEditProps) {
	const inherited = useContext(BoardLocaleContext);
	const locale = localeProp ?? inherited ?? "en";
	const messages = { ...(messagesByLocale[locale] ?? messagesByLocale.en), ...overrides };
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<"required" | "failed" | null>(null);
	const describedBy = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const busy = useRef(false);
	const left = useRef(false);
	const refocus = useRef(false);
	/** 每次打开、离开换一个编号，保存的结果回来时据此丢掉过期的。 */
	const session = useRef(0);

	useEffect(() => {
		if (editing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		} else if (refocus.current) {
			triggerRef.current?.focus();
		}
		refocus.current = false;
	}, [editing]);

	const leave = (focusTrigger: boolean) => {
		left.current = true;
		session.current += 1;
		busy.current = false;
		refocus.current = focusTrigger;
		setEditing(false);
		setPending(false);
		setError(null);
	};

	const commit = async (focusTrigger: boolean) => {
		if (busy.current) return;
		const next = draft.trim();
		if (!next && !allowEmpty) {
			setError("required");
			return;
		}
		if (next === value.trim()) {
			leave(focusTrigger);
			return;
		}
		const mine = session.current;
		busy.current = true;
		setPending(true);
		try {
			await onSave(next);
			if (session.current === mine) leave(focusTrigger);
		} catch {
			// 编辑器在保存期间关掉了：结果过期，不留痕迹
			if (session.current === mine) {
				busy.current = false;
				setError("failed");
				setPending(false);
			}
		}
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape") {
			// 只放弃这次编辑：不让 Esc 继续去退出全屏或取消别的操作
			event.preventDefault();
			event.stopPropagation();
			leave(true);
		} else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
			event.preventDefault();
			void commit(true);
		}
	};

	const rootClass = className ? `v-kanban__inline ${className}` : "v-kanban__inline";
	if (!editing) {
		return (
			<span className={rootClass}>
				<button
					ref={triggerRef}
					type="button"
					className="v-kanban__inline-trigger"
					aria-describedby={describedBy}
					data-empty={value ? undefined : "true"}
					onClick={(event) => {
						notifyEditing(event.currentTarget);
						left.current = false;
						session.current += 1;
						setDraft(value);
						setEditing(true);
					}}
				>
					{value || placeholder || label}
				</button>
				<span id={describedBy} className="v-kanban__sr-only">
					{label}
				</span>
			</span>
		);
	}
	return (
		<span className={rootClass} data-editing="true">
			<input
				ref={inputRef}
				type="text"
				className="v-kanban__inline-input"
				value={draft}
				maxLength={maxLength}
				placeholder={placeholder}
				aria-label={label}
				aria-invalid={error ? true : undefined}
				aria-busy={pending || undefined}
				readOnly={pending}
				onChange={(event) => {
					setDraft(event.target.value);
					setError(null);
				}}
				onKeyDown={onKeyDown}
				onBlur={() => {
					// 保存失败后留在编辑器里等用户处理：失去焦点不该悄悄再保存一次
					if (busy.current || left.current || error === "failed") return;
					// 空文字不允许时失去焦点就还原，而不是把人留在一个看不见的错误上
					if (!draft.trim() && !allowEmpty) leave(false);
					else void commit(false);
				}}
			/>
			{error ? (
				<span role="alert" className="v-kanban__inline-error">
					{error === "required" ? messages.required : messages.saveFailed}
				</span>
			) : null}
		</span>
	);
}
