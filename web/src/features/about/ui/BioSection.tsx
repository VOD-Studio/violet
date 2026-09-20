import { avatarUrl } from "@shared/lib/image-url";
import { ProfileMention } from "@shared/ui/article-embeds";

import { AboutChapter } from "./AboutChapter";
import styles from "./AboutSections.module.css";
import type { AboutSectionProps } from "./types";

/** 以文章口吻介绍站长与 Violet。 */
export function BioSection({ settings }: AboutSectionProps) {
	const siteName = normalizeSiteName(settings.site_name);
	const githubUsername = settings.github_username.trim();
	const ownerName = githubUsername || "xunrua";
	const role = settings.profile_role.trim() || "写代码的人 / 博客作者";
	const avatar = settings.avatar_url.trim();

	return (
		<AboutChapter id="bio" title="关于我 / About Me">
			<div className={styles.prose}>
				<p>
					嗨，我是{" "}
					<ProfileMention
						label={ownerName}
						actionLabel={githubUsername ? "去 GitHub 看看" : "继续读下去"}
						profile={{
							name: ownerName,
							subtitle: role,
							description: settings.tagline.trim() || undefined,
							avatarUrl: avatar ? avatarUrl(avatar, ownerName) : undefined,
							href: githubUsername
								? `https://github.com/${githubUsername}`
								: "/about",
						}}
					/>
					。现在更接近的标签是 <strong>{role}</strong>
					，不过标签只能说明很小一部分。
				</p>
				<p>
					多数时候，我在 <code>Go</code> 服务、<code>React</code>{" "}
					界面和还没收口的细节之间来回切换。功能能跑只是开始，我更在意它下次还好不好改。
				</p>
				<p>
					<strong>{siteName}</strong>{" "}
					是我留给自己的长期项目：文章记录我怎样理解问题，代码记录我怎样把理解变成可以运行的东西。
				</p>
				<p>
					这里不会摆一份包装过的履历。想继续认识我，可以从一篇文章、一次更新，或者下面这些仍在变化的细节开始。
				</p>
			</div>
		</AboutChapter>
	);
}

function normalizeSiteName(value: string): string {
	const name = value.trim();
	return !name || /^(my\s+)?blog$/i.test(name) ? "Violet" : name;
}
