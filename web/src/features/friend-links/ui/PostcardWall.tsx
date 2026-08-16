import { motion } from "motion/react";
import type { FriendLinkPublicDTO } from "../model/types";
import { FriendAvatar } from "./FriendAvatar";
import { hostOf, tiltOf } from "./postcard-helpers";

/** 邮戳：互换事实的印章，盖在每张明信片右下 */
function Postmark({ order }: { order: number }) {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute -bottom-2 right-4 flex size-16 -rotate-12 flex-col items-center justify-center rounded-full border-2 border-foreground/15 text-center font-mono text-[9px] uppercase leading-tight tracking-widest text-muted-foreground/60"
		>
			<span>exchanged</span>
			<span>№{String(order).padStart(2, "0")}</span>
		</span>
	);
}

/**
 * PostcardWall - /friends 页友链展示态（生产版）
 *
 * 设计意图：友链是远方朋友寄来的明信片——头像是邮票（虚线齿孔边），
 * 「EXCHANGED」邮戳标记互换事实，卡片带由 id 决定的确定性微旋转，
 * hover 时回正浮起，像从软木板上取下一张来看。
 *
 * 与 friends-lab 同名组件视觉一致，差异：
 * - 数据接真实 useQuery（DTO 形状不变）
 * - 由 F3 路由直接消费，无方向切换控件
 */
export function PostcardWall({ links }: { links: FriendLinkPublicDTO[] }) {
	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
			{links.map((link, i) => (
				<motion.a
					key={link.id}
					href={link.url}
					target="_blank"
					rel="noopener noreferrer"
					initial={{ opacity: 0, y: 20, rotate: tiltOf(link.id) }}
					whileInView={{ opacity: 1, y: 0, rotate: tiltOf(link.id) }}
					whileHover={{ rotate: 0, y: -6, scale: 1.015 }}
					viewport={{ once: true, margin: "-40px" }}
					transition={{ duration: 0.45, delay: i * 0.05 }}
					className={`group relative block rounded-md border border-edge-hairline bg-card p-6 shadow-sm transition-shadow hover:shadow-lg ${
						i % 2 === 1 ? "md:translate-y-6" : ""
					}`}
				>
					{/* 邮票：头像贴右上，虚线边模拟齿孔 */}
					<div className="absolute right-6 top-6 rounded-sm border border-dashed border-muted-foreground/40 bg-background p-1">
						<FriendAvatar
							name={link.name}
							avatarUrl={link.avatar_url}
							className="size-12 rounded-0.5 text-xl"
						/>
					</div>

					<p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
						Postcard
					</p>
					<h3 className="pr-16 font-mono text-xl font-bold text-foreground">
						{link.name}
					</h3>
					<p className="mt-1 font-mono text-xs text-muted-foreground">
						{hostOf(link.url)}
					</p>

					{link.description ? (
						<p className="mt-4 line-clamp-2 text-sm italic leading-relaxed text-muted-foreground">
							「{link.description}」
						</p>
					) : (
						<p className="mt-4 text-sm italic text-muted-foreground/50">
							（这位朋友什么也没写）
						</p>
					)}

					<div className="mt-5 flex items-center justify-between border-t border-edge-hairline pt-3 pr-16">
						<span className="font-mono text-xs text-muted-foreground">
							{link.owner_name ? `@${link.owner_name}` : "佚名站长"}
						</span>
						<span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 transition-colors group-hover:text-foreground">
							visit →
						</span>
					</div>

					<Postmark order={link.sort_order} />
				</motion.a>
			))}
		</div>
	);
}
