import { cn } from "cn";
import { AppWindow, PanelTop } from "lucide-react";
import { describeActivity, deviceActivities } from "../lib/presence";
import type { PresenceDevice } from "../model/types";
import { PresenceGlyph } from "./PresenceGlyph";
import { PresenceProgress } from "./PresenceProgress";

/**
 * 实时状态详情卡 props。
 */
export interface PresenceCardProps {
	/** 租约内在线的全部设备 */
	devices: PresenceDevice[];
	/** 详细展开的主设备，其余设备各占一行 */
	lead: PresenceDevice;
	/** 服务端时钟减本机时钟（毫秒） */
	clockOffset: number;
	className?: string;
}

/**
 * 「此刻」详情：主设备的媒体、应用与窗口按来源分行列出，其余在线设备各一行摘要。
 */
export function PresenceCard({ devices, lead, clockOffset, className }: PresenceCardProps) {
	const { media, application, window } = lead.sources;
	const others = devices.filter((device) => device.id !== lead.id);
	const empty = !media && !application && !window;

	return (
		<section aria-label="此刻" className={cn("text-sm", className)}>
			<header className="flex items-baseline justify-between gap-3">
				<span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
					此刻
				</span>
				<span className="truncate text-xs text-muted-foreground">{lead.display_name}</span>
			</header>

			{media ? (
				<div className="mt-3">
					<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<PresenceGlyph activity={{ kind: "media", media }} />
						<span>
							{media.state === "playing" ? "正在播放" : "已暂停"} ·{" "}
							{media.player_name}
						</span>
					</p>
					<p className="mt-2 truncate text-lg leading-snug font-semibold text-foreground">
						{media.title}
					</p>
					{media.artist || media.album ? (
						<p className="truncate text-muted-foreground">
							{[media.artist, media.album].filter(Boolean).join(" · ")}
						</p>
					) : null}
					<PresenceProgress media={media} device={lead} clockOffset={clockOffset} />
				</div>
			) : null}

			{application || window ? (
				<dl
					className={cn(
						"grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2",
						media ? "mt-4 border-t border-border/60 pt-3" : "mt-3",
					)}
				>
					{application ? (
						<>
							<dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<AppWindow aria-hidden="true" className="size-3.5" />
								正在使用
							</dt>
							<dd className="truncate text-foreground">{application.display_name}</dd>
						</>
					) : null}
					{window ? (
						<>
							<dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
								<PanelTop aria-hidden="true" className="size-3.5" />
								窗口
							</dt>
							<dd className="truncate text-foreground" title={window.title}>
								{window.title}
							</dd>
						</>
					) : null}
				</dl>
			) : null}

			{empty ? (
				<p className="mt-3 text-muted-foreground">在线，暂时没有分享的活动。</p>
			) : null}

			{others.length > 0 ? (
				<ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
					{others.map((device) => {
						const [first] = deviceActivities(device);
						return (
							<li key={device.id} className="flex min-w-0 items-center gap-2 text-xs">
								<span className="shrink-0 text-foreground">
									{device.display_name}
								</span>
								<span className="truncate text-muted-foreground">
									{first ? describeActivity(first) : "在线"}
								</span>
							</li>
						);
					})}
				</ul>
			) : null}

			<p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
				由 Nowbeam 上报，只包含站长主动分享的内容；离线后立即消失。
			</p>
		</section>
	);
}
