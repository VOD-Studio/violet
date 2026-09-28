import { useEffect, useRef, useState } from "react";

import { hexToHsv, hsvToHex } from "./hsv";

export interface HsvColorPickerProps {
	/** 当前颜色 #rrggbb */
	value: string;
	/** 任意来源（拖动/输入/预设）产生新颜色时回调 */
	onChange: (hex: string) => void;
}

/**
 * HsvColorPicker - 自绘 HSV 选色器（饱和度/明度面板 + 色相条 + hex 输入）。
 *
 * 不依赖原生 input[type=color]。营造法式色板生成器是第二个消费方，
 * 自 ColorSwatch 内部用法导出复用。
 */
export function HsvColorPicker({ value, onChange }: HsvColorPickerProps) {
	const [hsv, setHsv] = useState(() => hexToHsv(value));
	const svRef = useRef<HTMLDivElement>(null);
	const hueRef = useRef<HTMLDivElement>(null);

	// 外部 value 变化时同步（如点预设色）
	useEffect(() => {
		setHsv(hexToHsv(value));
	}, [value]);

	const commit = (next: { h: number; s: number; v: number }) => {
		setHsv(next);
		onChange(hsvToHex(next.h, next.s, next.v));
	};

	// 饱和度/明度面板指针拖动
	const handleSVPointer = (e: React.PointerEvent) => {
		const el = svRef.current;
		if (!el) return;
		el.setPointerCapture(e.pointerId);
		const move = (clientX: number, clientY: number) => {
			const rect = el.getBoundingClientRect();
			const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
			const v = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
			commit({ h: hsv.h, s, v });
		};
		move(e.clientX, e.clientY);
		const onMove = (ev: PointerEvent) => move(ev.clientX, ev.clientY);
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	// 色相条指针拖动
	const handleHuePointer = (e: React.PointerEvent) => {
		const el = hueRef.current;
		if (!el) return;
		el.setPointerCapture(e.pointerId);
		const move = (clientX: number) => {
			const rect = el.getBoundingClientRect();
			const h = Math.min(360, Math.max(0, ((clientX - rect.left) / rect.width) * 360));
			commit({ h, s: hsv.s, v: hsv.v });
		};
		move(e.clientX);
		const onMove = (ev: PointerEvent) => move(ev.clientX);
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

	return (
		<div className="space-y-2">
			{/* SV 面板：背景为当前色相纯色，叠加白→黑渐变模拟 S/V */}
			<div
				ref={svRef}
				onPointerDown={handleSVPointer}
				className="relative h-28 w-full cursor-crosshair rounded-md overflow-hidden touch-none"
				style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
			>
				{/* 白色横向渐变（饱和度）*/}
				<div className="absolute inset-0 bg-linear-to-r from-white to-transparent" />
				{/* 黑色纵向渐变（明度）*/}
				<div className="absolute inset-0 bg-linear-to-t from-black to-transparent" />
				{/* 指针 */}
				<div
					className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
					style={{
						left: `${hsv.s * 100}%`,
						top: `${(1 - hsv.v) * 100}%`,
					}}
				/>
			</div>
			{/* 色相条 */}
			<div
				ref={hueRef}
				onPointerDown={handleHuePointer}
				className="relative h-3 w-full cursor-pointer rounded-full touch-none"
				style={{
					background:
						"linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
				}}
			>
				<div
					className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
					style={{ left: `${(hsv.h / 360) * 100}%` }}
				/>
			</div>
			{/* 十六进制输入 + 预览 */}
			<div className="flex items-center gap-2">
				<span
					className="size-7 shrink-0 rounded-md border border-edge-hairline"
					style={{ backgroundColor: currentHex }}
				/>
				<input
					type="text"
					value={currentHex}
					onChange={(e) => {
						const hex = e.target.value;
						if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
							setHsv(hexToHsv(hex));
							onChange(hex);
						}
					}}
					className="h-7 w-full rounded-md border border-edge-hairline bg-transparent px-2 font-mono text-xs uppercase outline-none focus:border-primary"
					maxLength={7}
				/>
			</div>
		</div>
	);
}
