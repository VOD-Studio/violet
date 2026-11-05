"use client";

import { cn } from "cn";
import { useComposedRefs } from "radix-ui/internal";
import {
	type ComponentProps,
	createContext,
	type ReactNode,
	type Ref,
	use,
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

/** 组内选项的排列方式。 */
export type RadioOrientation = "vertical" | "horizontal";

/** default 是常规行式单选；card 是凹陷底选项卡片，圆点仍在左上。 */
export type RadioAppearance = "default" | "card";

/** 一组共享 name 与选中值的上下文；选中值始终由组统一裁决。 */
interface RadioGroupContextValue {
	name: string;
	appearance: RadioAppearance;
	groupDisabled: boolean;
	groupRequired: boolean;
	value?: string;
	select: (next: string) => void;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroup(part: string): RadioGroupContextValue {
	const context = use(RadioGroupContext);
	if (!context) throw new Error(`${part} must be used within <RadioGroup>.`);
	return context;
}

/**
 * 单选组：原生 fieldset + 同 name 的 radio，一个 Tab 位，方向键换选由浏览器完成。
 *
 * @remarks 组名通过 `legend` 提供（视觉隐藏）；省略 `name` 时自动生成。
 * 一组应有默认选中项（`defaultValue`），组件不强制也不提供「全不选」。
 */
export interface RadioGroupProps extends Omit<ComponentProps<"fieldset">, "name"> {
	/** 组的可访问名称；视觉隐藏，正常由外层表单项的可见文字承担。 */
	legend?: ReactNode;
	/** 同组 radio 的共享 name；省略时用 `useId` 生成稳定名称。 */
	name?: string;
	/** 受控选中值，值为选项的 `value`。 */
	value?: string;
	/** 非受控初始选中值。 */
	defaultValue?: string;
	/** 选中值真正变化时触发。 */
	onValueChange?: (value: string) => void;
	/** 选项排列方向，默认竖排。 */
	orientation?: RadioOrientation;
	/** default 行式或 card 选项卡片，默认 default。 */
	appearance?: RadioAppearance;
	/** 禁用整组（fieldset disabled）。 */
	disabled?: boolean;
	/** 要求整组必选（落在每个 input 上，交给原生校验）。 */
	required?: boolean;
	/** 指向 fieldset 元素。 */
	ref?: Ref<HTMLFieldSetElement>;
}

/** 在一组互斥选项里选一个的原生单选控件组。 */
export function RadioGroup({
	legend,
	name,
	value,
	defaultValue,
	onValueChange,
	orientation = "vertical",
	appearance = "default",
	disabled = false,
	required = false,
	className,
	children,
	ref,
	...props
}: RadioGroupProps) {
	const generatedName = useId();
	const groupName = name ?? generatedName;
	const fieldsetRef = useRef<HTMLFieldSetElement>(null);
	const composedRef = useComposedRefs(ref, fieldsetRef);
	const [inner, setInner] = useState(defaultValue);
	const current = value ?? inner;
	const initialRef = useRef(current);
	const stateRef = useRef({
		value: current,
		controlled: value !== undefined,
		onValueChange,
	});
	useLayoutEffect(() => {
		stateRef.current = {
			value: current,
			controlled: value !== undefined,
			onValueChange,
		};
	}, [current, value, onValueChange]);

	const select = useCallback((next: string | undefined) => {
		const state = stateRef.current;
		// 受控时也重渲染一次，把宿主拒绝的变更从 DOM 收回
		setInner(next);
		if (state.value === next) return;
		if (!state.controlled) {
			stateRef.current = { ...state, value: next };
		}
		// 没有初值时复位回到全不选，没有值可上报
		if (next !== undefined) state.onValueChange?.(next);
	}, []);

	useEffect(() => {
		const fieldset = fieldsetRef.current;
		if (!fieldset) return;
		const scopes = new Set<EventTarget>([fieldset.ownerDocument, fieldset.getRootNode()]);
		const pendingResets = new WeakSet<Event>();
		let active = true;
		const captureReset = (event: Event) => {
			const owner = fieldsetRef.current?.form ?? fieldsetRef.current?.closest("form");
			if (!owner || event.target !== owner || pendingResets.has(event)) return;
			pendingResets.add(event);
			const finishReset = () => {
				// 原生表单复位的默认动作可能在事件传播中执行微任务。
				if (active && event.eventPhase !== Event.NONE) {
					setTimeout(finishReset, 0);
					return;
				}
				pendingResets.delete(event);
				if (active && !event.defaultPrevented) {
					select(initialRef.current);
				}
			};
			queueMicrotask(finishReset);
		};
		for (const scope of scopes) scope.addEventListener("reset", captureReset, true);
		return () => {
			active = false;
			for (const scope of scopes) scope.removeEventListener("reset", captureReset, true);
		};
	}, [select]);

	const contextValue = useMemo(
		() => ({
			name: groupName,
			appearance,
			groupDisabled: disabled,
			groupRequired: required,
			value: current,
			select,
		}),
		[groupName, appearance, disabled, required, current, select],
	);

	return (
		<fieldset
			ref={composedRef}
			className={cn("v-radio-group", className)}
			data-orientation={orientation}
			data-appearance={appearance}
			disabled={disabled}
			{...props}
		>
			{legend == null ? null : <legend className="v-radio-group__legend">{legend}</legend>}
			<RadioGroupContext value={contextValue}>{children}</RadioGroupContext>
		</fieldset>
	);
}

/**
 * 组内的一个单选选项；整行是点击目标。
 *
 * @remarks ref、id 与其余原生属性落在真正的 input 上；`className`/`style`
 * 落在整行根节点。说明文字通过 `aria-describedby` 关联，不并入可访问名称。
 */
export interface RadioProps
	extends Omit<
		ComponentProps<"input">,
		"type" | "name" | "value" | "checked" | "defaultChecked" | "children"
	> {
	/** 表单提交与 `onValueChange` 使用的选项值。 */
	value: string;
	/** 选项文字。 */
	label: ReactNode;
	/** 选项说明（13px 次级文字），读屏随选项一起播报。 */
	description?: ReactNode;
}

export function Radio({
	value,
	label,
	description,
	disabled = false,
	required,
	className,
	style,
	id,
	onChange,
	ref,
	...props
}: RadioProps) {
	const group = useRadioGroup("Radio");
	const descriptionId = useId();
	const labelId = useId();
	const {
		"aria-describedby": describedByProp,
		"aria-label": ariaLabelProp,
		"aria-labelledby": ariaLabelledByProp,
		...rest
	} = props;
	const hasDescription = description != null;
	// 说明文字在 label 内可见，但不并入可访问名称：名称只指向选项文字本身
	const hasExplicitName = ariaLabelProp != null || ariaLabelledByProp != null;
	const ariaDescribedBy =
		[describedByProp, hasDescription ? descriptionId : undefined].filter(Boolean).join(" ") ||
		undefined;

	return (
		<label
			className={cn("v-radio", className)}
			style={style}
			data-appearance={group.appearance}
		>
			<input
				{...rest}
				ref={ref}
				id={id}
				type="radio"
				name={group.name}
				value={value}
				checked={group.value === value}
				disabled={disabled || group.groupDisabled}
				required={required ?? group.groupRequired}
				onChange={(event) => {
					onChange?.(event);
					// 合成 click 在浏览器里也会绕过 disabled 门，这里自己守住
					if (event.defaultPrevented || event.currentTarget.disabled) return;
					if (event.currentTarget.checked) group.select(value);
				}}
				aria-describedby={ariaDescribedBy}
				aria-label={ariaLabelProp}
				aria-labelledby={hasExplicitName ? ariaLabelledByProp : labelId}
			/>
			<span className="v-radio__control" aria-hidden="true" />
			<span className="v-radio__text">
				<span className="v-radio__label" id={hasExplicitName ? undefined : labelId}>
					{label}
				</span>
				{hasDescription ? (
					<span className="v-radio__description" id={descriptionId}>
						{description}
					</span>
				) : null}
			</span>
		</label>
	);
}
