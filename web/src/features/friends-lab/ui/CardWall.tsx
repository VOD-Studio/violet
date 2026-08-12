import { SpotlightCard } from "@shared/vendor/react-bits/SpotlightCard";
import { ArrowUpRight, Link2 } from "lucide-react";
import { motion } from "motion/react";
import { type FriendLinkDTO, hostOf } from "../model/mock";
import { FriendAvatar } from "./FriendAvatar";

/**
 * 名片卡面（纯渲染，无链接语义）
 *
 * 横向名片：左头像钢印、右身份区（站名 / mono 域名 / 描述 / 站长称呼），
 * 右上 mono 序号体现 sort_order 的编排语义。
 * 申请弹窗的实时预览复用此卡面。
 */
export function BusinessCardFace({
	link,
	className,
}: {
	link: Pick<FriendLinkDTO, "name" | "url" | "avatar_url" | "description" | "owner_name">;
	className?: string;
}) {
	return (
		<div className={className}>
			<div className="flex items-start gap-4">
				<FriendAvatar
					name={link.name}
					avatarUrl={link.avatar_url}
					className="size-14 rounded-lg text-2xl"
				/>
				<div className="min-w-0 flex-1">
					<h3 className="truncate font-semibold text-foreground">{link.name}</h3>
					<p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
						<Link2 className="size-3 shrink-0" />
						<span className="truncate">{hostOf(link.url)}</span>
					</p>
				</div>
			</div>
			{link.description ? (
				<p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
					{link.description}
				</p>
			) : null}
			{link.owner_name ? (
				<p className="mt-2 font-mono text-xs text-muted-foreground/70">
					@{link.owner_name}
				</p>
			) : null}
		</div>
	);
}

/**
 * 方向 A · 名片墙
 *
 * 设计意图：把「互换链接」直译为「交换名片」——每条友链是一张横版名片，
 * hover 时被「拿起」（SpotlightCard 边缘冷光 + 右上角箭头滑入），
 * 是三个方向中最贴全站语言的一版。
 */
export function CardWall({ links }: { links: FriendLinkDTO[] }) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{links.map((link, i) => (
				<motion.div
					key={link.id}
					initial={{ opacity: 0, y: 16 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-40px" }}
					transition={{ duration: 0.45, delay: i * 0.05 }}
				>
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						className="group block h-full"
					>
						<SpotlightCard className="h-full p-5">
							<div className="relative">
								<span className="absolute -top-1 right-0 font-mono text-[10px] tracking-widest text-muted-foreground/50">
									№{String(link.sort_order).padStart(2, "0")}
								</span>
								<ArrowUpRight className="absolute right-0 top-5 size-4 -translate-x-1 translate-y-1 text-muted-foreground opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
								<BusinessCardFace link={link} />
							</div>
						</SpotlightCard>
					</a>
				</motion.div>
			))}
		</div>
	);
}
