import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { type FriendLinkDTO, hostOf } from "../model/mock";

/**
 * 方向 C · 终端清单
 *
 * 设计意图：友链即 `$ ls ~/friends` 的输出——终端窗口里的 mono 目录学，
 * 每行一条记录，hover 行内展开详情（站长 / 描述），末尾是闪烁光标。
 * 与全站终端 DNA（LandingHero / TerminalCard / DecryptedText）同源，最极客的一版。
 */
export function TerminalList({ links }: { links: FriendLinkDTO[] }) {
	const [openId, setOpenId] = useState<string | null>(null);

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true }}
			transition={{ duration: 0.6 }}
			className="overflow-hidden rounded-2xl border border-edge-hairline"
			style={{ background: "var(--surface-glass)" }}
		>
			{/* 标题栏（TerminalCard 同款三灯） */}
			<div className="flex items-center justify-between border-b border-edge-hairline px-4 py-2.5">
				<div className="flex items-center gap-1.5">
					<span className="size-2.5 rounded-full bg-red-500/90" />
					<span className="size-2.5 rounded-full bg-amber-400/90" />
					<span className="size-2.5 rounded-full bg-emerald-400/90" />
				</div>
				<p className="m-0 font-mono text-[11px] tracking-[0.08em] text-muted-foreground">
					~/violet/friends
				</p>
			</div>

			<div className="bg-background/60 px-4 py-4 font-mono text-[13px] leading-7 md:px-6">
				<p className="m-0 mb-2">
					<span className="bg-linear-to-br from-neon-blue to-neon-purple bg-clip-text font-medium text-transparent">
						violet@blog
					</span>
					<span className="ml-px text-muted-foreground">:~$</span>
					<span className="ml-1 text-foreground">ls --friends</span>
					<span className="ml-2 text-muted-foreground/60">
						# {links.length} exchanged
					</span>
				</p>

				<ul className="m-0 list-none p-0">
					{links.map((link, i) => {
						const open = openId === link.id;
						return (
							<motion.li
								key={link.id}
								initial={{ opacity: 0, x: -8 }}
								whileInView={{ opacity: 1, x: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.3, delay: i * 0.04 }}
							>
								<a
									href={link.url}
									target="_blank"
									rel="noopener noreferrer"
									onMouseEnter={() => setOpenId(link.id)}
									onMouseLeave={() => setOpenId(null)}
									onFocus={() => setOpenId(link.id)}
									onBlur={() => setOpenId(null)}
									className="block rounded-md px-2 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
								>
									<span className="grid grid-cols-[3ch_1fr_auto] items-baseline gap-3 md:grid-cols-[3ch_24ch_1fr_auto]">
										<span className="text-muted-foreground/50">
											{String(link.sort_order).padStart(2, "0")}
										</span>
										<span className="truncate text-muted-foreground">
											{hostOf(link.url)}
										</span>
										<span className="hidden truncate font-semibold text-foreground md:inline">
											{link.name}
										</span>
										<ArrowUpRight
											className={`size-3.5 justify-self-end text-muted-foreground transition-all duration-200 ${
												open
													? "translate-x-0 opacity-100"
													: "-translate-x-1 opacity-0"
											}`}
										/>
									</span>
									{/* 行内展开：站长与一句话描述 */}
									<AnimatePresence initial={false}>
										{open ? (
											<motion.span
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: "auto", opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												transition={{ duration: 0.2 }}
												className="block overflow-hidden"
											>
												<span className="block py-1 pl-[calc(3ch+0.75rem)] text-xs text-muted-foreground">
													{link.owner_name
														? `@${link.owner_name}`
														: "anonymous"}
													{link.description
														? ` · ${link.description}`
														: ""}
												</span>
											</motion.span>
										) : null}
									</AnimatePresence>
								</a>
							</motion.li>
						);
					})}
				</ul>

				<p className="m-0 mt-2">
					<span className="bg-linear-to-br from-neon-blue to-neon-purple bg-clip-text font-medium text-transparent">
						violet@blog
					</span>
					<span className="ml-px text-muted-foreground">:~$</span>
					<span
						aria-hidden
						className="ml-1 inline-block h-[0.95em] w-[0.5em] animate-caret-blink rounded-0.25 bg-foreground/70 align-[-0.1em]"
					/>
				</p>
			</div>
		</motion.div>
	);
}
