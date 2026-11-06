"use client";

import { cn } from "cn";
import { X } from "lucide-react";
import { useComposedRefs, useControllableState } from "radix-ui/internal";
import {
	type ChangeEvent,
	type ClipboardEvent,
	type CSSProperties,
	type FocusEvent,
	type KeyboardEvent,
	type Ref,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { highlightMatch, PickerList, PickerOption, PickerPanel } from "../../lib/picker-panel";
import { type ListboxItem, useListbox } from "../../lib/use-listbox";
import { Spinner } from "../indicator";
import { type InputVariantProps, inputVariants } from "../input/styles";
import { commitTags, maxMessage, TAG_SEPARATORS, type TagRejection, tagKey } from "./commit-tags";

export type { TagRejection, TagRejectionReason } from "./commit-tags";

/** 重复项闪动的时长；样式里的动画时长与它一致。 */
const FLASH_MS = 600;

const NO_TAGS: string[] = [];

export interface TagInputProps extends InputVariantProps {
	/** 受控的标签列表；与 `onValueChange` 配合。 */
	value?: string[];
	defaultValue?: string[];
	/** 每次增删各调用一次；粘贴多段文本一次加入多个标签也只调用一次。 */
	onValueChange?: (value: string[]) => void;
	/** 标签数量上限；到达后输入框停用（`aria-disabled`，仍可聚焦）并说明原因。 */
	max?: number;
	/** 候选标签；给了才会在输入非空时弹出建议浮层，已选项不再推荐。 */
	suggestions?: readonly string[];
	/** 返回错误说明表示不合格，输入原样保留；通过返回 `null`。 */
	validate?: (tag: string) => string | null;
	/** 加入前整理文本，例如去掉 `#` 前缀；返回空串的标签被丢弃。 */
	normalize?: (raw: string) => string;
	/** 添加被拒绝（重复、到达上限、不合格）时调用，`message` 可直接写进表单项的提示或错误。 */
	onReject?: (rejection: TagRejection) => void;
	/** 没有任何标签时的占位文字。 */
	placeholder?: string;
	/** 表单字段名；每个标签渲染一个隐藏输入参与 FormData，没有标签就不提交。 */
	name?: string;
	/** 隐藏输入所属表单的 id，对应原生 `form` 属性。 */
	form?: string;
	disabled?: boolean;
	/** 只读：标签可读、输入框可聚焦，但不能增删。 */
	readOnly?: boolean;
	/** 写入输入框的 `aria-required`；必填交给表单项校验。 */
	required?: boolean;
	/** 出错外观，并写入 `aria-invalid`；显式值优先于传入的 `aria-invalid`。 */
	invalid?: boolean;
	/** 通过外观（成功色），只是视觉反馈。 */
	valid?: boolean;
	/** 输入区尾部显示加载指示并设 `aria-busy`。 */
	loading?: boolean;
	/** 建议浮层挂载的容器；默认 `document.body`。陈列室舞台与带缩放的宿主需要传入。 */
	container?: HTMLElement | null;
	/** 判断浮层「放不下」的边界，默认视口。 */
	collisionBoundary?: Element | null;
	/** 外壳（`div`）的类名与样式。 */
	className?: string;
	style?: CSSProperties;
	/** 以下接线属性落在真正的 `<input>` 上；`Field` 克隆进来的同名属性也走这里。 */
	id?: string;
	"aria-label"?: string;
	"aria-labelledby"?: string;
	/** 与组件自己的原因说明（上限、校验错误）取并集。 */
	"aria-describedby"?: string;
	"aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
	onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
	onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
	/** 指向内部的 `<input>`。 */
	ref?: Ref<HTMLInputElement>;
}

interface SuggestionOption {
	id: string;
	label: string;
	/** 「创建」项：没有同名候选时追加，选中等同于提交输入框里的原文。 */
	create: boolean;
}

function isInvalid(invalid: boolean | undefined, ariaInvalid: TagInputProps["aria-invalid"]) {
	return (
		invalid ??
		(ariaInvalid === true ||
			ariaInvalid === "true" ||
			ariaInvalid === "grammar" ||
			ariaInvalid === "spelling")
	);
}

/**
 * 在一个输入框里输入多个值的标签输入：外壳是输入框外壳，标签是行内芯片，内容多了自动换行变高。
 *
 * Enter、半角逗号、全角逗号、顿号、换行生成标签，空格不生成；重复项（不分大小写）不加，已有的那个闪一下；
 * 输入框为空时退格先选中最后一个标签，再按一次删除，左右键在标签间移动选中；失焦时输入中的文本自动成为标签。
 * 生成与删除由 `role="status"` 的区域播报。需要从已有标签里挑选时传 `suggestions`，
 * 输入框随之成为 `role="combobox"`，键盘与读屏与 combobox 一致。
 */
export function TagInput({
	ref,
	className,
	style,
	variant,
	controlSize,
	value,
	defaultValue,
	onValueChange,
	max,
	suggestions,
	validate,
	normalize,
	onReject,
	placeholder = "输入后按回车",
	name,
	form,
	disabled = false,
	readOnly = false,
	required = false,
	invalid,
	valid = false,
	loading = false,
	container,
	collisionBoundary,
	id,
	"aria-label": ariaLabel,
	"aria-labelledby": ariaLabelledBy,
	"aria-describedby": describedByProp,
	"aria-invalid": ariaInvalid,
	onFocus,
	onBlur,
}: TagInputProps) {
	const [tags = NO_TAGS, setTags] = useControllableState<string[]>({
		prop: value,
		defaultProp: defaultValue ?? NO_TAGS,
		onChange: onValueChange,
	});
	const [text, setText] = useState("");
	const [armed, setArmed] = useState<string | null>(null);
	const [focused, setFocused] = useState(false);
	const [dismissed, setDismissed] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [flash, setFlash] = useState<{ tag: string; phase: "a" | "b" } | null>(null);
	const [announcement, setAnnouncement] = useState({ seq: 0, text: "" });
	const [panelPresent, setPanelPresent] = useState(false);

	const shellRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const composedRef = useComposedRefs(ref, inputRef);
	const composing = useRef(false);
	const flashTimer = useRef<number | undefined>(undefined);
	const listboxId = useId();
	const noteId = useId();

	useEffect(() => () => clearTimeout(flashTimer.current), []);

	const full = max !== undefined && tags.length >= max;
	const note = error ?? (full ? maxMessage(max) : null);
	const editable = !disabled && !readOnly;
	const invalidState = isInvalid(invalid, ariaInvalid) || error !== null;
	const validState = valid && !invalidState;

	const announce = (message: string) =>
		setAnnouncement((previous) => ({ seq: previous.seq + 1, text: message }));

	const flashTag = (tag: string) => {
		clearTimeout(flashTimer.current);
		// 动画名在 a、b 两份之间轮换：连续重复时即使属性一直在，动画也会重播
		setFlash((previous) => ({ tag, phase: previous?.phase === "a" ? "b" : "a" }));
		flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
	};

	const report = (rejection: TagRejection) => {
		announce(rejection.message);
		onReject?.(rejection);
	};

	/**
	 * 提交一批文本；`rest` 是留在输入框里的内容。单段提交（回车、失焦、选建议）遇到 `validate`
	 * 不通过时保留输入原文，而不是清空。
	 */
	const submit = (parts: string[], rest: string, keepOnInvalid: boolean) => {
		const result = commitTags(tags, parts, { max, validate, normalize });
		const { rejection } = result;
		if (result.added.length > 0) setTags(result.tags);
		setArmed(null);
		setDismissed(false);
		setText(keepOnInvalid && rejection?.reason === "invalid" ? text : rest);
		setError(rejection?.reason === "invalid" ? rejection.message : null);
		if (result.duplicateOf !== null) flashTag(result.duplicateOf);
		const spoken: string[] = [];
		if (result.added.length > 0) spoken.push(`已添加 ${result.added.join("、")}`);
		if (rejection) spoken.push(rejection.message);
		if (spoken.length > 0) announce(spoken.join("。"));
		if (rejection) onReject?.(rejection);
	};

	const removeTag = (tag: string) => {
		const next = tags.filter((item) => item !== tag);
		setTags(next);
		setArmed(null);
		announce(`已移除 ${tag}，还有 ${next.length} 个`);
	};

	const arm = (index: number) => {
		const tag = tags[index];
		setArmed(tag);
		announce(`已选中 ${tag}，再按退格删除`);
	};

	const armedIndex = armed === null ? -1 : tags.indexOf(armed);

	// 建议：输入非空才有；未选的、包含查询串的；没有同名项时追加「创建」
	const trimmed = text.trim();
	const needle = trimmed && normalize ? normalize(trimmed).trim() : trimmed;
	const options = useMemo<SuggestionOption[]>(() => {
		if (!suggestions || !needle) return [];
		const selected = new Set(tags.map(tagKey));
		const key = tagKey(needle);
		const seen = new Set<string>();
		const list: SuggestionOption[] = [];
		let exact = selected.has(key);
		suggestions.forEach((label, index) => {
			const labelKey = tagKey(label);
			if (labelKey === key) exact = true;
			if (selected.has(labelKey) || seen.has(labelKey) || !labelKey.includes(key)) return;
			seen.add(labelKey);
			list.push({ id: `${listboxId}-s${index}`, label, create: false });
		});
		if (!exact) list.push({ id: `${listboxId}-create`, label: needle, create: true });
		return list;
	}, [suggestions, needle, tags, listboxId]);

	const open =
		suggestions !== undefined &&
		editable &&
		!full &&
		focused &&
		!dismissed &&
		options.length > 0;
	const items = useMemo<ListboxItem[]>(
		() => (open ? options.map((option) => ({ id: option.id })) : []),
		[open, options],
	);
	const listbox = useListbox({ items, open, selectedFor: "active" });

	// 收起动画期间沿用最后一次展开时的选项，面板不会在退场时塌成空的
	const lastOptions = useRef<SuggestionOption[]>([]);
	useLayoutEffect(() => {
		if (open) lastOptions.current = options;
	}, [open, options]);
	const shownOptions = open ? options : lastOptions.current;

	const pick = (option: SuggestionOption) => {
		submit([option.create ? text : option.label], "", true);
		inputRef.current?.focus({ preventScroll: true });
	};

	const handleText = (next: string, isComposing: boolean) => {
		setArmed(null);
		setDismissed(false);
		if (isComposing) {
			setText(next);
			setError(null);
			return;
		}
		const parts = next.split(TAG_SEPARATORS);
		if (parts.length === 1) {
			setText(next);
			setError(null);
			return;
		}
		submit(parts.slice(0, -1), parts[parts.length - 1], false);
	};

	const onChange = (event: ChangeEvent<HTMLInputElement>) => {
		const native = event.nativeEvent as InputEvent;
		handleText(event.currentTarget.value, composing.current || native.isComposing === true);
	};

	const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
		if (!editable) return;
		const pasted = event.clipboardData.getData("text");
		if (full) {
			event.preventDefault();
			report({ reason: "max", tag: "", message: maxMessage(max) });
			return;
		}
		if (!TAG_SEPARATORS.test(pasted)) return;
		// 浏览器会把粘贴的换行抹成空格，所以要自己读剪贴板；光标之后的文字留在输入框里
		event.preventDefault();
		const input = event.currentTarget;
		const start = input.selectionStart ?? text.length;
		const end = input.selectionEnd ?? start;
		submit((text.slice(0, start) + pasted).split(TAG_SEPARATORS), text.slice(end), false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!editable) return;
		const native = event.nativeEvent;
		// 输入法组合中的 Enter 是确认候选；Safari 在 compositionend 之后才发 keydown，只剩 keyCode 229
		if (composing.current || native.isComposing || native.keyCode === 229) return;
		if (event.altKey || event.ctrlKey || event.metaKey) return;

		if (full && (event.key === "Enter" || event.key.length === 1)) {
			event.preventDefault();
			report({ reason: "max", tag: "", message: maxMessage(max) });
			return;
		}

		switch (event.key) {
			case "Enter": {
				event.preventDefault();
				const option = open ? shownOptions[listbox.activeIndex] : undefined;
				if (option) pick(option);
				else if (text.trim()) submit([text], "", true);
				return;
			}
			case "Backspace": {
				if (armedIndex !== -1) {
					event.preventDefault();
					removeTag(tags[armedIndex]);
					return;
				}
				if (text !== "" || tags.length === 0) return;
				event.preventDefault();
				arm(tags.length - 1);
				return;
			}
			case "Delete": {
				if (armedIndex === -1) return;
				event.preventDefault();
				removeTag(tags[armedIndex]);
				return;
			}
			case "ArrowLeft": {
				if (tags.length === 0) return;
				const input = event.currentTarget;
				if (armedIndex === -1 && (input.selectionStart !== 0 || input.selectionEnd !== 0))
					return;
				event.preventDefault();
				arm(armedIndex === -1 ? tags.length - 1 : Math.max(0, armedIndex - 1));
				return;
			}
			case "ArrowRight": {
				if (armedIndex === -1) return;
				event.preventDefault();
				if (armedIndex < tags.length - 1) arm(armedIndex + 1);
				else setArmed(null);
				return;
			}
			case "ArrowDown":
			case "ArrowUp":
			case "PageDown":
			case "PageUp": {
				if (open) {
					if (listbox.handleKeyDown(event)) event.preventDefault();
				} else if (dismissed && options.length > 0 && event.key.startsWith("Arrow")) {
					event.preventDefault();
					setDismissed(false);
				}
				return;
			}
			case "Escape": {
				if (armedIndex !== -1) setArmed(null);
				return;
			}
		}
	};

	const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
		setFocused(true);
		onFocus?.(event);
	};

	// 点芯片的删除钮与选项时按下都不让焦点离开，所以输入框失焦一定是用户走开了
	const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
		setFocused(false);
		setArmed(null);
		onBlur?.(event);
		if (editable && text.trim()) submit([text], "", true);
	};

	// 表单复位：回到 defaultValue（没给则回到空），并清掉输入中的文本；事件被取消时不复位
	const resetRef = useRef<() => void>(() => {});
	resetRef.current = () => {
		setText("");
		setError(null);
		setArmed(null);
		setTags(defaultValue ?? NO_TAGS);
	};
	useEffect(() => {
		const byId = form ? document.getElementById(form) : null;
		const owner =
			byId instanceof HTMLFormElement ? byId : (inputRef.current?.closest("form") ?? null);
		if (!owner) return;
		const onReset = (event: Event) => {
			setTimeout(() => {
				if (!event.defaultPrevented) resetRef.current();
			}, 0);
		};
		owner.addEventListener("reset", onReset);
		return () => owner.removeEventListener("reset", onReset);
	}, [form]);

	const describedBy = [describedByProp, note ? noteId : undefined].filter(Boolean).join(" ");
	const showPanel = open || panelPresent;
	const comboboxProps = suggestions
		? {
				role: "combobox" as const,
				"aria-haspopup": "listbox" as const,
				"aria-expanded": open,
				"aria-controls": listboxId,
				"aria-autocomplete": "list" as const,
			}
		: undefined;

	return (
		<div
			ref={shellRef}
			data-slot="tag-input"
			data-invalid={invalidState ? "" : undefined}
			data-valid={validState ? "" : undefined}
			data-disabled={disabled ? "" : undefined}
			data-readonly={readOnly ? "" : undefined}
			data-full={full ? "" : undefined}
			data-loading={loading ? "" : undefined}
			style={style}
			className={inputVariants({
				variant,
				controlSize,
				className: cn("v-tag-input", className),
			})}
			onMouseDown={(event) => {
				if (event.button !== 0 || disabled) return;
				if ((event.target as Element).closest("button, input")) return;
				event.preventDefault();
				setArmed(null);
				inputRef.current?.focus();
			}}
		>
			{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: role 与 aria-label 同用一个三元，空标签时两者都为 undefined，不会落在无角色的 div 上 */}
			<div
				role={tags.length > 0 ? "list" : undefined}
				aria-label={tags.length > 0 ? "已添加的标签" : undefined}
				className="v-tag-input__list"
			>
				{tags.map((tag) => (
					<span
						key={tag}
						role="listitem"
						className="v-tag-input__chip"
						data-armed={tag === armed ? "" : undefined}
						data-dup={flash?.tag === tag ? flash.phase : undefined}
						data-removable={editable ? "" : undefined}
					>
						<span className="v-tag-input__label">{tag}</span>
						{editable ? (
							<button
								type="button"
								tabIndex={-1}
								className="v-tag-input__remove"
								aria-label={`移除 ${tag}`}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => removeTag(tag)}
							>
								<X aria-hidden="true" />
							</button>
						) : null}
					</span>
				))}
				<div role={tags.length > 0 ? "none" : undefined} className="v-tag-input__field">
					<input
						ref={composedRef}
						data-slot="tag-input-input"
						className="v-input v-tag-input__input"
						type="text"
						id={id}
						value={text}
						disabled={disabled}
						readOnly={readOnly || full}
						placeholder={tags.length === 0 && !full ? placeholder : undefined}
						autoComplete="off"
						autoCapitalize="off"
						spellCheck={false}
						{...comboboxProps}
						aria-activedescendant={open ? listbox.activeId : undefined}
						aria-label={ariaLabel}
						aria-labelledby={ariaLabelledBy}
						aria-describedby={describedBy || undefined}
						aria-invalid={
							error !== null ? true : invalid === undefined ? ariaInvalid : invalid
						}
						aria-required={required || undefined}
						aria-disabled={full ? true : undefined}
						aria-busy={loading || undefined}
						onChange={onChange}
						onPaste={onPaste}
						onKeyDown={onKeyDown}
						onCompositionStart={() => {
							composing.current = true;
						}}
						onCompositionEnd={(event) => {
							composing.current = false;
							handleText(event.currentTarget.value, false);
						}}
						onFocus={handleFocus}
						onBlur={handleBlur}
					/>
				</div>
			</div>
			{loading ? (
				<span className="v-input-control__status" data-status="loading">
					<Spinner size={16} aria-hidden="true" />
				</span>
			) : null}
			{note ? (
				<span id={noteId} className="v-tag-input__sr">
					{note}
				</span>
			) : null}
			<div role="status" aria-live="polite" className="v-tag-input__sr">
				{announcement.text ? <span key={announcement.seq}>{announcement.text}</span> : null}
			</div>
			{name
				? tags.map((tag) => (
						<input
							key={tag}
							type="hidden"
							name={name}
							form={form}
							value={tag}
							disabled={disabled}
						/>
					))
				: null}
			{showPanel ? (
				<PickerPanel
					open={open}
					onOpenChange={(next) => {
						if (!next) setDismissed(true);
					}}
					anchorRef={shellRef}
					container={container}
					collisionBoundary={collisionBoundary}
					className="v-tag-input-content"
					onPresenceChange={setPanelPresent}
				>
					<PickerList id={listboxId} mode={listbox.mode} aria-label="标签建议">
						{shownOptions.map((option, index) => (
							<PickerOption
								key={option.id}
								{...(open
									? listbox.getItemProps(index)
									: {
											id: option.id,
											role: "option" as const,
											"aria-selected": false,
										})}
								ref={(element: HTMLElement | null) =>
									listbox.registerItem(option.id, element)
								}
								onClick={() => pick(option)}
							>
								{option.create
									? `创建「${option.label}」`
									: highlightMatch(option.label, needle)}
							</PickerOption>
						))}
					</PickerList>
				</PickerPanel>
			) : null}
		</div>
	);
}
