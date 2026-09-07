import { Heart, Mail, Rss } from "lucide-react";
import { motion } from "motion/react";

import { useLeaveSiteImpression } from "./api/mutations";
import { useSiteImpression } from "./api/queries";
import type { SiteIdentity } from "./types";

interface HomeClosingProps {
	identity: SiteIdentity;
}

/** 依月份生成温润应季寄语。 */
function getSeasonalGreeting(): { title: string; subtitle: string } {
	const month = new Date().getMonth() + 1;
	if (month >= 3 && month <= 5) return { title: "花朝如约", subtitle: "春山可望" };
	if (month >= 6 && month <= 8) return { title: "熏风入弦", subtitle: "荷风送香" };
	if (month >= 9 && month <= 11) return { title: "桂月流光", subtitle: "掬光以待" };
	return { title: "梅信岁寒", subtitle: "围炉夜话" };
}

/** 首页收尾：季节寄语、匿名印记与服务端声明的订阅渠道。 */
export function HomeClosing({ identity }: HomeClosingProps) {
	const greeting = getSeasonalGreeting();
	const impressionQuery = useSiteImpression();
	const impressionMutation = useLeaveSiteImpression();
	const impression = impressionMutation.data ?? impressionQuery.data;
	const impressionLabel = impressionMutation.isError
		? "重试留下印记"
		: impression?.impressed
			? "印记已留下"
			: "留下印记";

	return (
		<section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24">
			<motion.div
				initial={false}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.9 }}
				className="mx-auto max-w-4xl px-5 text-center sm:px-8"
			>
				<div className="space-y-2">
					<p className="font-serif text-2xl font-normal tracking-widest text-foreground/90 sm:text-3xl">
						{greeting.title}
					</p>
					<h2 className="font-serif text-2xl font-normal tracking-[0.08em] text-foreground/90 sm:text-3xl">
						{greeting.subtitle}
					</h2>
				</div>

				<div className="mt-14 flex items-center justify-center gap-8 sm:gap-14">
					<button
						type="button"
						aria-pressed={impression?.impressed ?? false}
						disabled={impressionMutation.isPending || impression?.impressed}
						onClick={() => impressionMutation.mutate()}
						title={
							impressionMutation.isError
								? "印记提交失败，点击重试"
								: impressionQuery.isError
									? "印记读取失败，点击即可重新登记"
									: undefined
						}
						className="group flex flex-col items-center gap-1.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-default"
					>
						<span className="text-xs text-muted-foreground/80 transition-colors group-hover:text-foreground">
							{impressionLabel}
						</span>
						<span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground/80 transition-colors group-hover:text-primary">
							<Heart
								className={`size-3.5 transition-colors duration-200 ${
									impression?.impressed
										? "fill-primary text-primary"
										: "text-muted-foreground/60 group-hover:text-primary"
								}`}
							/>
							<span className="tabular-nums">
								{impressionMutation.isPending ? "…" : (impression?.count ?? "—")}
							</span>
						</span>
					</button>

					{identity.subscription_channels.length > 0 ? (
						<>
							<div aria-hidden className="h-8 w-px bg-border/40" />
							<div className="flex items-center gap-6">
								{identity.subscription_channels.map((channel) => {
									const ChannelIcon = channel.kind === "rss" ? Rss : Mail;
									return (
										<a
											key={`${channel.kind}:${channel.href}`}
											href={channel.href}
											className="group flex flex-col items-center gap-1.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
										>
											<span className="text-xs text-muted-foreground/80 transition-colors group-hover:text-foreground">
												{channel.label}
											</span>
											<span className="inline-flex items-center gap-1.5 text-xs text-foreground/80 transition-colors group-hover:text-primary">
												<ChannelIcon className="size-3 text-muted-foreground/60 transition-colors group-hover:text-primary" />
												<span className="font-normal tracking-wide text-muted-foreground/80 group-hover:text-foreground">
													不错过每一纸书。
												</span>
											</span>
										</a>
									);
								})}
							</div>
						</>
					) : null}
				</div>
			</motion.div>
		</section>
	);
}
