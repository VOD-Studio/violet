"use client";

import { cn } from "cn";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { useComposedRefs } from "radix-ui/internal";
import { type ComponentProps, type MouseEvent, type ReactNode, useId } from "react";
import { iconProps } from "../icons";
import { type InputClassNames, type InputVariantProps, inputVariants } from "../input";
import { decimalPlaces, toBound, toText } from "./number-value";
import { type NumberInputVariantProps, numberInputVariants } from "./styles";
import { useNumberHold } from "./use-number-hold";
import { useNumberInput } from "./use-number-input";

/** 原生文本输入的数值编辑契约；ref、className、style 与表单属性均属于 input。 */
export interface NumberInputProps
	extends Omit<
			ComponentProps<"input">,
			"type" | "inputMode" | "role" | "min" | "max" | "step" | "value" | "defaultValue"
		>,
		InputVariantProps,
		NumberInputVariantProps {
	value?: string | number;
	defaultValue?: string | number;
	/** 接受 number 或 register() 返回的 string；空串表示不设界。 */
	min?: number | string;
	max?: number | string;
	step?: number;
	/** 省略时由 step 推导；提交后以固定小数位显示。 */
	precision?: number;
	/** 空白提交为 null；关闭时恢复上次提交值，无初值则从 min 或 0 开始。 */
	allowEmpty?: boolean;
	leading?: ReactNode;
	trailing?: ReactNode;
	invalid?: boolean;
	classNames?: InputClassNames;
	/** 仅在 Enter、失焦或步进改变已提交数值时触发；原生 onChange 仍报告每次草稿及规范化写回。 */
	onValueCommit?: (value: number | null) => void;
}

/** 允许不完整草稿、范围约束与长按步进的数值输入。 */
export function NumberInput({
	ref,
	variant,
	controlSize,
	className,
	classNames,
	leading,
	trailing,
	controls = "sides",
	step: stepProp = 1,
	precision: precisionProp,
	allowEmpty = true,
	min: minProp,
	max: maxProp,
	invalid,
	id,
	onValueCommit,
	...props
}: NumberInputProps) {
	const min = toBound(minProp);
	const max = toBound(maxProp);
	const step = Number.isFinite(stepProp) && stepProp > 0 ? stepProp : 1;
	const precision = Math.max(0, Math.min(100, Math.trunc(precisionProp ?? decimalPlaces(step))));
	const rules = { min, max, step, precision, allowEmpty };
	const input = useNumberInput({ ...props, onValueCommit }, rules);
	const composedRef = useComposedRefs(ref, input.inputRef);
	const generatedId = useId();
	const isInvalid =
		input.outOfRange ||
		(invalid ??
			(props["aria-invalid"] === true ||
				props["aria-invalid"] === "true" ||
				props["aria-invalid"] === "grammar" ||
				props["aria-invalid"] === "spelling"));
	const hold = useNumberHold(input.step, Boolean(props.disabled || props.readOnly));
	const focusFromShell = (event: MouseEvent<HTMLDivElement>) => {
		if (
			event.button !== 0 ||
			props.disabled ||
			(event.target as Element).closest("button, input")
		)
			return;
		event.preventDefault();
		input.inputRef.current?.focus();
	};
	const button = (direction: 1 | -1) => (
		<button
			type="button"
			tabIndex={-1}
			className={cn("v-number-input__step", classNames?.action)}
			aria-label={direction === 1 ? "增加" : "减少"}
			disabled={
				props.disabled ||
				props.readOnly ||
				(input.parsed !== null &&
					(direction === 1
						? max !== undefined && input.parsed >= max
						: min !== undefined && input.parsed <= min))
			}
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				input.inputRef.current?.focus({ preventScroll: true });
				hold.start(event, direction);
			}}
			onPointerUp={hold.stop}
			onPointerLeave={hold.stop}
			onPointerCancel={hold.stop}
			onLostPointerCapture={hold.stop}
			onMouseDown={(event) => event.preventDefault()}
			onClick={(event) => {
				if (event.detail === 0) input.step(direction * (event.shiftKey ? 10 : 1));
			}}
		>
			{controls === "stacked" ? (
				direction === 1 ? (
					<ChevronUp {...iconProps(14)} aria-hidden="true" />
				) : (
					<ChevronDown {...iconProps(14)} aria-hidden="true" />
				)
			) : direction === 1 ? (
				<Plus {...iconProps(14)} aria-hidden="true" />
			) : (
				<Minus {...iconProps(14)} aria-hidden="true" />
			)}
		</button>
	);
	return (
		<div
			data-slot="number-input-control"
			data-disabled={props.disabled ? "" : undefined}
			data-readonly={props.readOnly ? "" : undefined}
			data-invalid={isInvalid ? "" : undefined}
			className={cn(
				inputVariants({ variant, controlSize }),
				numberInputVariants({ controls }),
				classNames?.control,
			)}
			onMouseDown={focusFromShell}
			onBlurCapture={hold.stop}
		>
			{controls === "sides" && button(-1)}
			{leading != null && (
				<span className={cn("v-input-control__leading", classNames?.leading)}>
					{leading}
				</span>
			)}
			<input
				{...props}
				ref={composedRef}
				id={id ?? generatedId}
				type="text"
				inputMode="decimal"
				role="spinbutton"
				value={props.value === undefined ? undefined : toText(props.value)}
				defaultValue={props.value === undefined ? input.defaultText : undefined}
				className={cn("v-input v-number-input__input", classNames?.input, className)}
				aria-valuenow={input.parsed ?? undefined}
				aria-valuemin={min}
				aria-valuemax={max}
				aria-invalid={
					isInvalid || (invalid === undefined ? props["aria-invalid"] : invalid)
				}
				onChange={input.onChange}
				onFocus={input.onFocus}
				onBlur={input.onBlur}
				onKeyDown={input.onKeyDown}
				onPaste={input.onPaste}
			/>
			{trailing != null && (
				<span className={cn("v-input-control__trailing", classNames?.trailing)}>
					{trailing}
				</span>
			)}
			{controls === "sides" && button(1)}
			{controls === "stacked" && (
				<span className="v-number-input__stack">
					{button(1)}
					{button(-1)}
				</span>
			)}
		</div>
	);
}
