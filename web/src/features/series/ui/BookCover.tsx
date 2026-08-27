import { cn } from "@shared/lib/utils";

import type { SeriesSummary } from "../model/types";

export type BookCoverSize = "sm" | "md" | "lg";

interface BookCoverProps {
	/** 书摘要（书架项或详情的前缀字段集） */
	book: Pick<SeriesSummary, "title" | "cover_image" | "slug">;
	className?: string;
	/** sm=书架格、md=默认、lg=详情页大封 */
	size?: BookCoverSize;
	/** 有封面时的视觉主标（默认 book.title） */
	subtitle?: string;
	/** 无封面排版书衣的落款行（默认站点名） */
	footerText?: string;
}

/**
 * 实体书封：统一书壳（右书口页线 + 轻透视 + 落影），
 * 有图=照片书衣（74% 图 + 26% 实色书名区），无图=排版式书衣（多轮 lab 验收定论，
 * 不用 ImageOff 占位）。
 */
export function BookCover({
	book,
	className,
	size = "md",
	subtitle,
	footerText = "Violet Editions",
}: BookCoverProps) {
	const compact = size === "sm";
	const large = size === "lg";

	return (
		<div
			role="img"
			aria-label={`${book.title}封面`}
			className={cn("relative isolate aspect-2/3 [perspective:1200px]", className)}
		>
			<div
				aria-hidden="true"
				className="absolute -bottom-1 right-1 left-2 h-3 rounded-full bg-black/25 blur-md"
			/>
			<div
				aria-hidden="true"
				className="absolute inset-y-1 right-0 w-3 rounded-r-sm border-r-2 border-stone-700 bg-[#e8e2d8] shadow-sm"
			>
				<span className="absolute inset-y-1 left-1/3 w-px bg-stone-400/55" />
				<span className="absolute inset-y-1 left-2/3 w-px bg-stone-400/30" />
			</div>
			<div
				className="absolute inset-y-0 right-2 left-0 overflow-hidden rounded-sm border border-black/10 shadow-lg [backface-visibility:hidden]"
				style={{
					transform: "rotateY(-5deg)",
					transformOrigin: "left center",
					transformStyle: "preserve-3d",
				}}
			>
				{book.cover_image ? (
					<PhotoJacket book={book} compact={compact} large={large} subtitle={subtitle} />
				) : (
					<TypographicJacket
						book={book}
						compact={compact}
						large={large}
						subtitle={subtitle}
						footerText={footerText}
					/>
				)}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-y-0 left-0 z-20 w-2 bg-linear-to-r from-black/30 to-transparent"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-px rounded-xs ring-1 ring-white/15"
				/>
			</div>
		</div>
	);
}

function PhotoJacket({
	book,
	compact,
	large,
	subtitle,
}: {
	book: Pick<SeriesSummary, "title" | "cover_image">;
	compact: boolean;
	large: boolean;
	subtitle?: string;
}) {
	return (
		<div className="relative h-full bg-stone-950 text-white">
			<img
				src={book.cover_image}
				alt=""
				loading="lazy"
				className="h-[74%] w-full object-cover"
			/>
			<div className="absolute inset-x-0 top-0 flex items-center justify-between bg-black/55 px-3 py-2 font-mono text-[7px] tracking-[0.18em] text-white/80 uppercase">
				<span>Violet Editions</span>
				<span>Online Book</span>
			</div>
			<div
				className={cn(
					"absolute inset-x-0 bottom-0 flex h-[26%] flex-col justify-center bg-stone-950",
					compact ? "px-3" : "px-4",
				)}
			>
				<p
					className={cn(
						"line-clamp-2 font-serif leading-tight",
						compact ? "text-xs" : large ? "text-lg" : "text-sm",
					)}
				>
					{book.title}
				</p>
				{compact || !subtitle ? null : (
					<p
						className={cn(
							"mt-1 line-clamp-1 font-serif text-white/60 italic",
							large ? "text-xs" : "text-[9px]",
						)}
					>
						{subtitle}
					</p>
				)}
			</div>
		</div>
	);
}

function TypographicJacket({
	book,
	compact,
	large,
	subtitle,
	footerText,
}: {
	book: Pick<SeriesSummary, "title">;
	compact: boolean;
	large: boolean;
	subtitle?: string;
	footerText: string;
}) {
	const coverMark = book.title.slice(0, 2);
	return (
		<div className="relative h-full overflow-hidden bg-[#d8e1dc] text-[#17372f]">
			<div className="flex h-[18%] items-center justify-between bg-[#315b50] px-4 font-mono text-[8px] tracking-[0.18em] text-white/80 uppercase">
				<span>{footerText}</span>
				<span>Online Book</span>
			</div>
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute top-[18%] right-0 font-serif leading-none text-[#315b50]/10",
					compact ? "text-5xl" : large ? "text-8xl" : "text-7xl",
				)}
			>
				{coverMark}
			</div>
			<div className={cn("flex h-[82%] flex-col justify-between", compact ? "p-3" : "p-4")}>
				<p className="font-mono text-[8px] tracking-[0.2em] text-[#315b50]/60 uppercase">
					Online Book
				</p>
				<div>
					<h2
						className={cn(
							"line-clamp-3 font-serif leading-tight",
							compact ? "text-sm" : large ? "text-2xl" : "text-lg",
						)}
					>
						{book.title}
					</h2>
					{compact || !subtitle ? null : (
						<p
							className={cn(
								"mt-2 line-clamp-3 font-serif leading-snug text-[#315b50]/70 italic",
								large ? "text-sm" : "text-[11px]",
							)}
						>
							{subtitle}
						</p>
					)}
				</div>
				<div className="flex justify-between border-t border-[#315b50]/25 pt-2 font-mono text-[8px] text-[#315b50]/65 uppercase">
					<span>Technical Series</span>
				</div>
			</div>
		</div>
	);
}
