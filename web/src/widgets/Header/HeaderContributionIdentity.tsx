import type { SiteSettings } from "@features/settings/model/types";
import { avatarUrl } from "@shared/lib/image-url";
import { GithubIcon } from "@shared/ui/icons";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, Sparkles } from "lucide-react";

interface HeaderContributionIdentityProps {
	settings?: SiteSettings;
	onNavigate?: () => void;
}

/**
 * 站长开源档案卡片头标与社交矩阵
 *
 * 负责展示站长头像、用户名、标语简介、社交直达与项目跳转。
 */
export function HeaderContributionIdentity({
	settings,
	onNavigate,
}: HeaderContributionIdentityProps) {
	const siteName = settings?.site_name?.trim() || "Violet";
	const githubUsername = settings?.github_username?.trim() || "";
	const ownerName = githubUsername || siteName;
	const bio = settings?.bio?.trim() || settings?.tagline?.trim() || "";
	const configuredAvatar = settings?.avatar_url?.trim();
	const githubAvatar = githubUsername
		? `https://github.com/${encodeURIComponent(githubUsername)}.png?size=96`
		: "";
	const avatar = configuredAvatar ? avatarUrl(configuredAvatar, ownerName) : githubAvatar;
	const email = settings?.social_email?.trim() || "";

	return (
		<div className="space-y-4">
			{/* 身份头标 */}
			<div className="flex items-center gap-3">
				{avatar ? (
					<img
						src={avatar}
						alt={ownerName}
						className="size-11 rounded-full object-cover ring-1 ring-border/50"
					/>
				) : (
					<span
						aria-hidden="true"
						className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-border/50"
					>
						<svg
							aria-hidden="true"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="size-5"
						>
							<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
							<path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
						</svg>
					</span>
				)}
				<div className="min-w-0">
					<Link
						to="/"
						onClick={onNavigate}
						className="block truncate font-mono text-sm font-bold text-foreground transition-colors hover:text-primary"
					>
						{ownerName}
					</Link>
					{bio ? <p className="truncate text-xs text-muted-foreground">{bio}</p> : null}
				</div>
			</div>

			{/* 社交矩阵与项目直达 */}
			<div className="flex items-center justify-between border-y border-border/40 py-2.5">
				<div className="flex items-center gap-1.5">
					{githubUsername ? (
						<a
							href={`https://github.com/${githubUsername}`}
							target="_blank"
							rel="noreferrer"
							aria-label="GitHub 主页"
							className="flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
						>
							<GithubIcon className="size-3.5" />
						</a>
					) : null}
					{email ? (
						<a
							href={`mailto:${email}`}
							aria-label="发送邮件"
							className="flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
						>
							<Mail className="size-3.5" />
						</a>
					) : null}
					<Link
						to="/about"
						onClick={onNavigate}
						aria-label="关于站长"
						className="flex size-7 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
					>
						<Sparkles className="size-3.5" />
					</Link>
				</div>

				<Link
					to="/projects"
					onClick={onNavigate}
					className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
				>
					开源项目
					<ArrowUpRight className="size-3" />
				</Link>
			</div>
		</div>
	);
}
