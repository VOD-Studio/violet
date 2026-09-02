import { cn } from "@shared/lib/utils";
import { ChevronLeft, Layers, PanelLeft, PanelLeftClose } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface TocFloatingSwitcherProps<V extends string> {
	variant: V;
	variants: { value: V; label: string }[];
	onVariantChange: (value: V) => void;
	isCompact: boolean;
	onToggleCompact: () => void;
}

/** 长条项：圆角胶囊，激活方案高亮反色。 */
function BarChip({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"h-8 shrink-0 cursor-pointer rounded-full px-2.5 font-mono text-[11px] whitespace-nowrap transition-colors duration-150",
				active
					? "bg-foreground font-semibold text-background"
					: "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
			)}
		>
			{label}
		</button>
	);
}

/**
 * 悬浮风格切换长条：右下角常驻浮钮（Layers 图标 + 当前方案名），
 * 点击后长条自右下原点滑入替位；滚动/选择/点外部即收起。
 */
export function TocFloatingSwitcher<V extends string>({
	variant,
	variants,
	onVariantChange,
	isCompact,
	onToggleCompact,
}: TocFloatingSwitcherProps<V>) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const openScrollY = useRef(0);
	const current = variants.find((v) => v.value === variant);

	// 展开后滚动即收起：长条是临时浮层，不应在阅读区常驻遮挡
	useEffect(() => {
		if (!open) return;
		openScrollY.current = window.scrollY;
		// scroll 自身即为节流信号，直接判定（rAF 在无绘制帧环境不回调）
		const onScroll = () => {
			if (Math.abs(window.scrollY - openScrollY.current) > 60) setOpen(false);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [open]);

	// 点击外部 / Esc 收起
	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: PointerEvent) => {
			if (rootRef.current?.contains(event.target as Node)) return;
			setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const pick = (value: V) => {
		onVariantChange(value);
		setOpen(false);
	};

	return (
		<div ref={rootRef} className="fixed right-6 bottom-6 z-40">
			{/* 完整长条：与浮钮同一右下锚点，错峰滑入替位（浮钮先退，长条后进，避免交叠穿帮） */}
			<div
				className={cn(
					"absolute right-0 bottom-0 flex w-max items-center gap-0.5 rounded-full border border-edge-hairline bg-background/95 p-1.5 shadow-lg backdrop-blur-md",
					"origin-bottom-right transition-[translate,scale,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
					open
						? "pointer-events-auto translate-x-0 scale-100 opacity-100 delay-100"
						: "pointer-events-none translate-x-3 scale-95 opacity-0 delay-0",
				)}
			>
				{variants.map((v) => (
					<BarChip
						key={v.value}
						label={v.label}
						active={v.value === variant}
						onClick={() => pick(v.value)}
					/>
				))}
				<span className="mx-1 h-4 w-px shrink-0 bg-border" />
				<button
					type="button"
					onClick={() => {
						onToggleCompact();
						setOpen(false);
					}}
					className="mx-0.5 flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-muted/50 px-2.5 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
				>
					{isCompact ? (
						<PanelLeft className="size-3.5" />
					) : (
						<PanelLeftClose className="size-3.5" />
					)}
					{isCompact ? "展开目录" : "收起为窄轨"}
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					aria-label="收起长条"
					className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
				>
					<ChevronLeft className="size-4" />
				</button>
			</div>

			{/* 收起态浮钮：先退（无延迟），长条收走后再回归，错峰交棒 */}
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-expanded={open}
				aria-label="展开目录方案长条"
				className={cn(
					"flex h-10 cursor-pointer items-center gap-2 rounded-full border border-edge-hairline bg-background/95 px-4 font-mono text-xs font-semibold text-foreground shadow-lg backdrop-blur-md transition-[translate,scale,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
					open
						? "pointer-events-none scale-95 opacity-0 delay-0"
						: "scale-100 translate-x-0 opacity-100 delay-150",
				)}
			>
				<Layers className="size-4" />
				{current?.label}
			</button>
		</div>
	);
}
