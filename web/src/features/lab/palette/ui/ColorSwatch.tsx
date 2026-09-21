import type { TokenItem } from "@features/lab/palette/model/tokens";
import { copyText } from "@shared/lib/clipboard";
import { getContrastRatio, getWcagRating, oklchToRgb, parseOklch } from "@shared/lib/color-math";
import { cn } from "@shared/lib/utils";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * ColorSwatchProps - 色彩样本卡片入参
 */
export interface ColorSwatchProps {
	token: TokenItem;
	mode: "light" | "dark";
	bgCanvasOklch?: string;
	className?: string;
}

/**
 * ColorSwatch - 展示单个色彩令牌的视觉样本、科学参数与对比度。
 */
export function ColorSwatch({ token, mode, bgCanvasOklch, className }: ColorSwatchProps) {
	const [copied, setCopied] = useState<string | null>(null);

	const rawOklch = mode === "light" ? token.light : token.dark;
	const parsed = parseOklch(rawOklch);
	const rgb = parsed ? oklchToRgb(parsed.l, parsed.c, parsed.h, parsed.alpha) : null;
	const hex = rgb ? rgb.hex.toUpperCase() : "—";

	// 对比度评估：表面材质衡量其上文字的前景色对比度；前景色与动作色衡量其相对画布的对比度
	const fallbackBg = mode === "light" ? "oklch(0.992 0.003 286)" : "oklch(0.138 0.012 286)";
	const canvasColor = bgCanvasOklch ?? fallbackBg;

	const isSurfaceToken = Boolean(token.isSurface && token.onSurfaceForeground);
	const onSurfaceFg = token.onSurfaceForeground
		? mode === "light"
			? token.onSurfaceForeground.light
			: token.onSurfaceForeground.dark
		: null;

	const contrast =
		isSurfaceToken && onSurfaceFg
			? getContrastRatio(onSurfaceFg, rawOklch)
			: getContrastRatio(rawOklch, canvasColor);
	const wcag = getWcagRating(contrast);

	const handleCopy = async (text: string, label: string) => {
		const ok = await copyText(text);
		if (ok) {
			setCopied(label);
			toast.success(`已复制 ${label}: ${text}`);
			setTimeout(() => setCopied(null), 2000);
		} else {
			toast.error(`复制 ${label} 失败，请检查剪贴板权限`);
		}
	};

	return (
		<div
			className={cn(
				"group relative flex flex-col rounded-xl border border-edge-hairline bg-card p-4 transition-colors hover:border-brand/40",
				className,
			)}
		>
			{/* 顶部色彩色块 */}
			<div
				className="relative mb-3.5 h-28 w-full overflow-hidden rounded-lg border border-edge-hairline/60 shadow-xs"
				style={{ backgroundColor: rawOklch }}
			>
				{/* 表面材质：显示其实际承载文字的真实质感 */}
				{isSurfaceToken && onSurfaceFg && (
					<div
						className="absolute inset-0 flex flex-col justify-center px-3.5 pointer-events-none"
						style={{ color: onSurfaceFg }}
					>
						<span className="font-mono text-sm font-semibold tracking-tight">
							Aa 示例文本
						</span>
						<span className="text-[10px] opacity-80">
							{token.onSurfaceForeground?.name}
						</span>
					</div>
				)}

				{/* 对比度角标 */}
				<div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white shadow-xs backdrop-blur-xs">
					<span
						className={cn(
							"size-1.5 rounded-full",
							wcag.isAccessible ? "bg-emerald-400" : "bg-amber-400",
						)}
					/>
					<span className="font-mono">
						{isSurfaceToken ? "Aa " : ""}
						{contrast}:1
					</span>
					<span className="text-white/80">{wcag.rating}</span>
				</div>

				{/* 悬停快捷复制按钮栏 */}
				<div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1 opacity-90 transition-opacity md:opacity-0 md:group-hover:opacity-100">
					<button
						type="button"
						onClick={() => handleCopy(hex, "Hex")}
						className="flex items-center gap-1 rounded-md border border-white/20 bg-black/60 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-xs transition-colors hover:bg-black/80"
					>
						{copied === "Hex" ? (
							<Check className="size-3 text-emerald-400" />
						) : (
							<Copy className="size-3" />
						)}
						<span>{hex}</span>
					</button>

					<button
						type="button"
						onClick={() => handleCopy(rawOklch, "OKLCH")}
						className="flex items-center gap-1 rounded-md border border-white/20 bg-black/60 px-2 py-1 font-mono text-[10px] text-white backdrop-blur-xs transition-colors hover:bg-black/80"
					>
						{copied === "OKLCH" ? (
							<Check className="size-3 text-emerald-400" />
						) : (
							<Copy className="size-3" />
						)}
						<span>OKLCH</span>
					</button>
				</div>
			</div>

			{/* 色彩信息区 */}
			<div className="flex flex-1 flex-col justify-between">
				<div>
					<div className="flex items-baseline justify-between gap-2">
						<h3 className="text-sm font-semibold tracking-tight">{token.name}</h3>
						<span className="font-mono text-[11px] text-muted-foreground">
							{token.role}
						</span>
					</div>

					<button
						type="button"
						onClick={() => handleCopy(`var(${token.variable})`, "CSS Variable")}
						className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-brand"
					>
						<span>{token.variable}</span>
						{copied === "CSS Variable" ? (
							<Check className="size-3 text-emerald-500" />
						) : (
							<Copy className="size-3 opacity-60" />
						)}
					</button>

					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
						{token.description}
					</p>
				</div>

				{/* 科学参数行 */}
				<div className="mt-3 flex items-center justify-between border-t border-edge-hairline/60 pt-2.5 font-mono text-[11px] text-muted-foreground/80">
					<span>
						L: {parsed?.l ?? "—"} · C: {parsed?.c ?? "—"}
						{parsed && parsed.alpha < 1 && ` · α: ${Math.round(parsed.alpha * 100)}%`}
					</span>
					<span>H: {parsed?.h}°</span>
				</div>
			</div>
		</div>
	);
}
