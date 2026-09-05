import type { SiteSettings } from "@features/settings/model/types";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Archive,
	BookOpenText,
	FileText,
	FlaskConical,
	Images,
	MessageCircle,
	NotebookPen,
	Users,
} from "lucide-react";
import { motion } from "motion/react";

interface HomeClosingProps {
	settings: SiteSettings | null;
}

type DiscoveryPath =
	| "/blog"
	| "/series"
	| "/notes"
	| "/galleries"
	| "/tweets"
	| "/friends"
	| "/projects"
	| "/blog/archive";

interface DiscoveryLink {
	to: DiscoveryPath;
	label: string;
	Icon: LucideIcon;
}

const DISCOVERY_LINKS: DiscoveryLink[] = [
	{ to: "/blog", label: "文章", Icon: FileText },
	{ to: "/notes", label: "笔记", Icon: NotebookPen },
	{ to: "/series", label: "系列", Icon: BookOpenText },
	{ to: "/galleries", label: "图集", Icon: Images },
	{ to: "/tweets", label: "推文", Icon: MessageCircle },
	{ to: "/friends", label: "朋友们", Icon: Users },
	{ to: "/projects", label: "项目", Icon: FlaskConical },
	{ to: "/blog/archive", label: "时间归档", Icon: Archive },
];

/** 风向标式收束把站内路径平铺为轻量入口。 */
export function HomeClosing({ settings }: HomeClosingProps) {
	return (
		<section className="mx-auto max-w-7xl px-5 py-28 sm:px-8 lg:px-12 lg:py-36">
			<motion.div
				initial={false}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.9 }}
				className="flex flex-col items-center text-center"
			>
				<h2 className="text-2xl font-medium tracking-[-0.02em]">继续逛逛</h2>
				<p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
					文章之外，还有随手记录、图像、项目与站内来往。
				</p>
				<nav aria-label="首页探索导航" className="mt-14">
					<ul className="flex max-w-4xl flex-wrap justify-center gap-x-7 gap-y-8 sm:gap-x-10">
						{DISCOVERY_LINKS.map(({ to, label, Icon }, index) => (
							<motion.li
								key={to}
								initial={false}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{
									type: "spring",
									stiffness: 160,
									damping: 18,
									delay: index * 0.045,
								}}
							>
								<Link
									to={to}
									className="group flex items-center gap-3 text-sm text-muted-foreground transition-[color,transform] duration-200 hover:-translate-y-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
								>
									<Icon className="size-5 transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none" />
									<span>{label}</span>
								</Link>
							</motion.li>
						))}
					</ul>
				</nav>
				{settings?.social_rss ? (
					<a
						href={settings.social_rss}
						className="mt-14 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transition-none"
					>
						订阅 RSS
					</a>
				) : null}
			</motion.div>
		</section>
	);
}
