"use client";

import { cn } from "cn";
import { CircleAlert } from "lucide-react";
import {
	type ComponentProps,
	cloneElement,
	createContext,
	Fragment,
	isValidElement,
	type ReactNode,
	useContext,
	useId,
	useMemo,
} from "react";
import { iconProps } from "../icons";
import { Label } from "./label";

/** 表单项传给控件的接线属性，经 `useFieldControl()` 取得。 */
export interface FieldControlProps {
	id?: string;
	/** 指向标签元素：`<label for>` 不能命名的组合控件（`role="group"` 等）靠它得到可访问名称。原生表单控件不需要，自动接线也不注入。 */
	"aria-labelledby"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: true;
}

const NO_FIELD: FieldControlProps = {};
const FieldControlContext = createContext<FieldControlProps>(NO_FIELD);

/**
 * 取当前表单项为控件准备的 `id`、`aria-describedby` 与 `aria-invalid`，展开到控件上。
 * 给 `InputOTP`、`Segmented` 这类没有单一 `for` 目标的组合控件在 Field 内部自取；
 * 在 Field 之外调用返回空对象，不抛错。
 */
export function useFieldControl(): FieldControlProps {
	return useContext(FieldControlContext);
}

/** 字数：`value >= max * 0.9` 时变危险色。只是展示，不截断输入。 */
export interface FieldCount {
	value: number;
	max: number;
}

interface FieldMessages {
	/** 出错文案，最优先；带警示图标。 */
	error?: ReactNode;
	/** 检查中文案，如「正在检查…」。 */
	checking?: ReactNode;
	/** 通过文案，只给异步检查通过这类确有意义的时刻。 */
	success?: ReactNode;
	/** 默认提示。 */
	hint?: ReactNode;
}

function present(node: ReactNode) {
	return node != null && node !== false && node !== "";
}

type MessageState = "error" | "checking" | "success" | "hint" | "idle";

/** 同一位置永远只显示一条：error > checking > success > hint。 */
function pickMessage({ error, checking, success, hint }: FieldMessages): [MessageState, ReactNode] {
	if (present(error)) return ["error", error];
	if (present(checking)) return ["checking", checking];
	if (present(success)) return ["success", success];
	if (present(hint)) return ["hint", hint];
	return ["idle", null];
}

function FieldMeta({ id, count, ...messages }: FieldMessages & { id: string; count?: FieldCount }) {
	const [state, content] = pickMessage(messages);
	return (
		<div className="v-field__meta">
			<span id={id} className="v-field__message" aria-live="polite" data-state={state}>
				{state === "error" ? (
					<CircleAlert {...iconProps(14, "v-field__icon")} aria-hidden="true" />
				) : null}
				{content === null ? null : <span>{content}</span>}
			</span>
			{count ? (
				<span
					className="v-field__count"
					data-over={count.value >= count.max * 0.9 || undefined}
				>
					{`${count.value} / ${count.max}`}
				</span>
			) : null}
		</div>
	);
}

function OptionalMark() {
	return <span className="v-field__optional">（选填）</span>;
}

/** 控件自带的、需要与表单项合并或让位的接线属性。 */
interface ControlOwnProps {
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}

/**
 * 表单项属性。`label` 以外都是可选；控件自己的 `id`、`aria-describedby`、`aria-invalid` 优先，
 * `aria-describedby` 与消息元素合并。
 */
export interface FieldProps extends Omit<ComponentProps<"div">, "children">, FieldMessages {
	/** 标签文案。可访问名称只取它，「（选填）」不在 `<label>` 里。 */
	label: ReactNode;
	/** 选填：在标签后追加「（选填）」。必填不加红星。 */
	optional?: boolean;
	/** 标签行里紧跟在标签后的附件，如说明入口按钮；在 `<label>` 之外，不进可访问名称。 */
	labelEnd?: ReactNode;
	/** 字数，在消息行右端。 */
	count?: FieldCount;
	/** `horizontal` 为设置页的排法：标签在左，容器窄于 36rem 时回到纵向。默认纵向。 */
	orientation?: "vertical" | "horizontal";
	/** 只影响横排：标签行高与控件的 32 / 36 / 40 对齐，默认 `md`。 */
	controlSize?: "sm" | "md" | "lg";
	/** 控件不是 children 的唯一元素时，手动指定 `<label for>` 的目标 id。 */
	htmlFor?: string;
	/** 单个 React 元素时自动接线；否则不注入，用 `useFieldControl()` 自取。 */
	children: ReactNode;
}

/**
 * 把一个控件包成表单里的一项：标签、提示、错误与字数。控件本身不管这些。
 * 提示与错误占同一个消息行（`aria-live="polite"`），恒占一行高，出错时下方内容不跳。
 *
 * @example
 * <Field label="邮箱" optional hint="只用于回复通知，不会公开" error={emailError}>
 *   <Input type="email" autoComplete="email" />
 * </Field>
 */
export function Field({
	label,
	optional = false,
	labelEnd,
	error,
	checking,
	success,
	hint,
	count,
	orientation = "vertical",
	controlSize = "md",
	htmlFor,
	className,
	children,
	...props
}: FieldProps) {
	const generated = useId();
	const messageId = `${generated}-message`;
	const labelId = `${generated}-label`;
	const hasError = present(error);

	const control =
		isValidElement<ControlOwnProps>(children) && children.type !== Fragment ? children : null;
	const controlId = control?.props.id ?? htmlFor ?? `${generated}-control`;

	const wiring = useMemo<FieldControlProps>(
		() => ({
			id: controlId,
			"aria-labelledby": labelId,
			"aria-describedby": messageId,
			"aria-invalid": hasError ? true : undefined,
		}),
		[controlId, labelId, messageId, hasError],
	);

	const describedBy = [control?.props["aria-describedby"], messageId].filter(Boolean).join(" ");
	const wired = control
		? cloneElement(control, {
				id: controlId,
				"aria-describedby": describedBy,
				"aria-invalid": control.props["aria-invalid"] ?? (hasError ? true : undefined),
			})
		: children;

	return (
		<FieldControlContext.Provider value={wiring}>
			<div
				{...props}
				className={cn(
					"v-field",
					orientation === "horizontal" && "v-field--horizontal",
					className,
				)}
				data-control-size={controlSize}
				data-invalid={hasError || undefined}
			>
				<div className="v-field__layout">
					<div className="v-field__label">
						<Label id={labelId} htmlFor={controlId}>
							{label}
						</Label>
						{optional ? <OptionalMark /> : null}
						{labelEnd ? <span className="v-field__label-end">{labelEnd}</span> : null}
					</div>
					<div className="v-field__body">
						<div className="v-field__control">{wired}</div>
						<FieldMeta
							id={messageId}
							error={error}
							checking={checking}
							success={success}
							hint={hint}
							count={count}
						/>
					</div>
				</div>
			</div>
		</FieldControlContext.Provider>
	);
}

/** 一组表单项属性：组名写在 legend，选项下方的消息行承载组的提示与错误。 */
export interface FieldSetProps extends Omit<ComponentProps<"fieldset">, "children"> {
	/** 组名，样式与标签一致。 */
	legend: ReactNode;
	/** 选填：在组名后追加「（选填）」。 */
	optional?: boolean;
	/** 组说明，在组名之下、选项之上。 */
	description?: ReactNode;
	/** 选项下方消息行的默认提示。 */
	hint?: ReactNode;
	/** 组的错误；与 `hint` 同位互换。 */
	error?: ReactNode;
	children: ReactNode;
}

/**
 * 几个选项属于同一个问题时的表单项：`<fieldset>` + `<legend>`，错误写在组的消息行里，
 * `fieldset` 的 `aria-describedby` 指向它。选项自己的标签由调用方写。
 *
 * @example
 * <FieldSet legend="通知方式" description="至少选一种" error={none ? "至少选一种通知方式" : undefined}>
 *   <Checkbox … />
 * </FieldSet>
 */
export function FieldSet({
	legend,
	optional = false,
	description,
	hint,
	error,
	className,
	children,
	...props
}: FieldSetProps) {
	const generated = useId();
	const messageId = `${generated}-message`;
	const descriptionId = `${generated}-description`;
	const hasDescription = present(description);
	const describedBy = [
		props["aria-describedby"],
		hasDescription ? descriptionId : undefined,
		messageId,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<fieldset
			{...props}
			aria-describedby={describedBy}
			className={cn("v-field v-field--group", className)}
			data-invalid={present(error) || undefined}
		>
			<legend className="v-field__label">
				{legend}
				{optional ? <OptionalMark /> : null}
			</legend>
			{hasDescription ? (
				<p id={descriptionId} className="v-field__description">
					{description}
				</p>
			) : null}
			<div className="v-field__control">{children}</div>
			<FieldMeta id={messageId} error={error} hint={hint} />
		</fieldset>
	);
}
