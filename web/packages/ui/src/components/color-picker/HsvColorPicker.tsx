import { cn } from "cn";
import { Pipette } from "lucide-react";
import { useComposedRefs } from "radix-ui/internal";
import {
	type ComponentProps,
	type PointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Input } from "../input";
import { hexToHsv, normalizeHexColor } from "./hsv";
import { useColorPicker } from "./use-color-picker";
import { useFormReset } from "./use-form-reset";

interface EyeDropperInstance {
	open: (options: { signal: AbortSignal }) => Promise<{ sRGBHex: string }>;
}
type EyeDropperConstructor = new () => EyeDropperInstance;

/** 共用取色面板；HEX 草稿归面板持有，onChange 只返回合法的完整小写 HEX。 */
export interface HsvColorPickerProps
	extends Omit<ComponentProps<"div">, "onChange" | "defaultValue"> {
	value: string;
	onChange: (hex: string) => void;
	/** 一次完整拖动、键盘步进、HEX 失焦或吸管选择完成；适合记录最近用色。 */
	onColorCommit?: (hex: string) => void;
	/** 默认取挂载时颜色；受控外部更新不会改变比较基准。 */
	originalValue?: string;
	disabled?: boolean;
	readOnly?: boolean;
	invalid?: boolean;
	onValidityChange?: (valid: boolean) => void;
	/** 原生 HEX input 属性、ref、名称与描述；值和 onChange 由面板管理。 */
	hexInputProps?: Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type">;
	onEyeDropperError?: (error: unknown) => void;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** 可拖动、键盘微调和输入 HEX 的 HSV 面板，不包含浮层。 */
export function HsvColorPicker({
	value,
	onChange,
	onColorCommit,
	originalValue,
	disabled = false,
	readOnly = false,
	invalid,
	onValidityChange,
	hexInputProps = {},
	onEyeDropperError,
	className,
	...props
}: HsvColorPickerProps) {
	const picker = useColorPicker({ value, onChange, onColorCommit, onValidityChange });
	const [initial] = useState(value);
	const original = normalizeHexColor(originalValue ?? initial) ?? picker.hex;
	const [EyeDropper, setEyeDropper] = useState<EyeDropperConstructor | null>(null);
	const [picking, setPicking] = useState(false);
	const eyeRequest = useRef<AbortController | null>(null);
	const drag = useRef<{ id: number; kind: "sv" | "hue" } | null>(null);
	const locked = disabled || readOnly;
	const lockedNow = useRef(locked);
	lockedNow.current = locked;
	const commitNow = useRef(picker.commit);
	commitNow.current = picker.commit;
	const hexInput = useRef<HTMLInputElement | null>(null);
	const cancelEye = useCallback(() => {
		const request = eyeRequest.current;
		if (!request) return;
		eyeRequest.current = null;
		request.abort();
		setPicking(false);
	}, []);
	const { h, s, v } = picker.hsv;
	const {
		ref: hexRef,
		onBlur,
		onFocus,
		onKeyDown,
		className: hexClassName,
		...inputProps
	} = hexInputProps;
	const composedHexRef = useComposedRefs(hexRef, hexInput);

	useEffect(() => {
		const EyeDropperClass = (window as Window & { EyeDropper?: EyeDropperConstructor })
			.EyeDropper;
		if (EyeDropperClass) setEyeDropper(() => EyeDropperClass);
		return cancelEye;
	}, [cancelEye]);
	// 吸管进行中变为禁用/只读：请求立即失效，迟到的结果不再落地。
	useEffect(() => {
		if (locked) cancelEye();
	}, [locked, cancelEye]);
	useFormReset(hexInput, picker.reset);

	const point = (event: PointerEvent<HTMLDivElement>, kind: "sv" | "hue") => {
		const rect = event.currentTarget.getBoundingClientRect();
		if (rect.width <= 0 || (kind === "sv" && rect.height <= 0)) return;
		const x = clamp((event.clientX - rect.left) / rect.width);
		picker.commit(
			kind === "sv"
				? { h, s: x, v: clamp(1 - (event.clientY - rect.top) / rect.height) }
				: { h: x * 360, s, v },
		);
	};
	const down = (event: PointerEvent<HTMLDivElement>, kind: "sv" | "hue") => {
		if (event.defaultPrevented || locked || event.button !== 0 || drag.current) return;
		event.preventDefault();
		event.currentTarget.focus({ preventScroll: true });
		event.currentTarget.setPointerCapture?.(event.pointerId);
		drag.current = { id: event.pointerId, kind };
		point(event, kind);
	};
	const move = (event: PointerEvent<HTMLDivElement>, kind: "sv" | "hue") => {
		if (!locked && drag.current?.id === event.pointerId && drag.current.kind === kind)
			point(event, kind);
	};
	const up = (event: PointerEvent<HTMLDivElement>) => {
		if (drag.current?.id !== event.pointerId) return;
		drag.current = null;
		if (event.currentTarget.hasPointerCapture?.(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId);
		if (!locked) picker.finish();
	};
	const cancel = (event: PointerEvent<HTMLDivElement>) => {
		if (drag.current?.id === event.pointerId) drag.current = null;
	};
	const eye = async () => {
		if (!EyeDropper || lockedNow.current || eyeRequest.current) return;
		const controller = new AbortController();
		eyeRequest.current = controller;
		setPicking(true);
		// 请求身份、abort 与最新锁定状态共同决定结果是否还属于当前面板。
		const current = () =>
			eyeRequest.current === controller && !controller.signal.aborted && !lockedNow.current;
		try {
			const result = await new EyeDropper().open({ signal: controller.signal });
			const hex = normalizeHexColor(result.sRGBHex);
			if (hex && current()) commitNow.current(hexToHsv(hex), true);
		} catch (error) {
			if (current() && !(error instanceof DOMException && error.name === "AbortError"))
				onEyeDropperError?.(error);
		} finally {
			if (eyeRequest.current === controller) {
				eyeRequest.current = null;
				setPicking(false);
			}
		}
	};

	return (
		<div
			{...props}
			className={cn("v-color-picker", className)}
			data-disabled={disabled || undefined}
			data-readonly={readOnly || undefined}
		>
			<div
				className="v-color-picker__sv"
				role="slider"
				tabIndex={disabled ? -1 : 0}
				aria-label="饱和度与明度"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(s * 100)}
				aria-valuetext={`饱和度 ${Math.round(s * 100)}%，明度 ${Math.round(v * 100)}%`}
				aria-disabled={disabled || undefined}
				aria-readonly={readOnly || undefined}
				style={{ backgroundColor: `hsl(${h} 100% 50%)` }}
				onPointerDown={(event) => down(event, "sv")}
				onPointerMove={(event) => move(event, "sv")}
				onPointerUp={up}
				onPointerCancel={cancel}
				onLostPointerCapture={cancel}
				onKeyDown={(event) => {
					if (event.defaultPrevented || locked) return;
					const step = event.shiftKey ? 0.1 : 0.01;
					const offsets: Record<string, [number, number]> = {
						ArrowLeft: [-step, 0],
						ArrowRight: [step, 0],
						ArrowUp: [0, step],
						ArrowDown: [0, -step],
					};
					const offset = offsets[event.key];
					if (!offset) return;
					event.preventDefault();
					picker.commit({ h, s: clamp(s + offset[0]), v: clamp(v + offset[1]) }, true);
				}}
			>
				<span className="v-color-picker__white" />
				<span className="v-color-picker__black" />
				<span
					className="v-color-picker__point"
					style={{
						left: `${s * 100}%`,
						top: `${(1 - v) * 100}%`,
						backgroundColor: picker.hex,
					}}
				/>
			</div>
			<div
				className="v-color-picker__hue"
				role="slider"
				tabIndex={disabled ? -1 : 0}
				aria-label="色相"
				aria-valuemin={0}
				aria-valuemax={360}
				aria-valuenow={Math.round(h)}
				aria-valuetext={`色相 ${Math.round(h)}°`}
				aria-orientation="horizontal"
				aria-disabled={disabled || undefined}
				aria-readonly={readOnly || undefined}
				onPointerDown={(event) => down(event, "hue")}
				onPointerMove={(event) => move(event, "hue")}
				onPointerUp={up}
				onPointerCancel={cancel}
				onLostPointerCapture={cancel}
				onKeyDown={(event) => {
					if (event.defaultPrevented || locked) return;
					const step = event.shiftKey ? 10 : 1;
					const offsets: Record<string, number> = {
						ArrowLeft: -step,
						ArrowRight: step,
						ArrowDown: -step,
						ArrowUp: step,
					};
					const delta = offsets[event.key];
					if (delta === undefined && event.key !== "Home" && event.key !== "End") return;
					event.preventDefault();
					picker.commit(
						{
							h:
								event.key === "Home"
									? 0
									: event.key === "End"
										? 360
										: (h + (delta ?? 0) + 360) % 360,
							s,
							v,
						},
						true,
					);
				}}
			>
				<span
					className="v-color-picker__hue-thumb"
					style={{ left: `${(h / 360) * 100}%`, backgroundColor: `hsl(${h} 100% 50%)` }}
				/>
			</div>
			<div className="v-color-picker__row">
				<Input
					{...inputProps}
					ref={composedHexRef}
					className={cn("v-color-picker__hex-input", hexClassName)}
					classNames={{ control: "v-color-picker__hex" }}
					aria-label={inputProps["aria-label"] ?? "十六进制颜色值"}
					leading="#"
					controlSize="sm"
					autoComplete="off"
					spellCheck={false}
					disabled={disabled}
					readOnly={readOnly}
					invalid={invalid ?? (picker.invalid ? true : undefined)}
					value={picker.draft ?? picker.hex.slice(1).toUpperCase()}
					onChange={(event) => {
						if (!locked) picker.input(event.target.value);
					}}
					onFocus={onFocus}
					onBlur={(event) => {
						onBlur?.(event);
						if (!event.defaultPrevented) picker.blur();
					}}
					onKeyDown={(event) => {
						onKeyDown?.(event);
						if (!event.defaultPrevented && !locked && event.key === "Enter") {
							event.preventDefault();
							picker.blur();
						}
					}}
				/>
				{EyeDropper && (
					<button
						type="button"
						className="v-color-picker__eye"
						aria-label="从屏幕取色"
						aria-busy={picking || undefined}
						disabled={locked || picking}
						onClick={() => {
							void eye();
						}}
					>
						<Pipette aria-hidden="true" />
					</button>
				)}
				<div className="v-color-picker__comparison">
					<button
						type="button"
						aria-label={`恢复原颜色 ${original.toUpperCase()}`}
						title="恢复原颜色"
						disabled={locked}
						style={{ backgroundColor: original }}
						onClick={() => picker.commit(hexToHsv(original), true)}
					/>
					<span
						role="img"
						aria-label={`新颜色 ${picker.hex.toUpperCase()}`}
						style={{ backgroundColor: picker.hex }}
					/>
				</div>
			</div>
		</div>
	);
}
