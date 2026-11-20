import { useDecorationLayers } from "@features/seasonal-decor/hooks/useDecorationLayers";
import { useDecorationSeason } from "@features/seasonal-decor/hooks/useDecorationSeason";
import { CornerIllustration } from "@features/seasonal-decor/ui/CornerIllustration";
import { useSettings } from "@features/settings/api/queries";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import styles from "./auth-page.module.css";

type AuthPageLayoutProps = {
	title: string;
	description: ReactNode;
	children: ReactNode;
};

/** 账号入口共用信纸布局；窄屏保留品牌返回链接，表单优先。 */
export function AuthPageLayout({ title, description, children }: AuthPageLayoutProps) {
	const { data: settings } = useSettings();
	const name = settings?.site_name?.trim() || "Violet";
	const tagline = settings?.tagline?.trim() || "一花一叶，皆成文章。";
	const season = useDecorationSeason();
	const { illustration } = useDecorationLayers();

	return (
		<div className="relative isolate mx-auto flex w-full max-w-360 flex-1 flex-col px-4 sm:px-8 lg:px-12">
			{season && illustration ? (
				<div
					className={`${styles.illustration} hidden lg:block`}
					data-mirror={season === "spring" || season === "autumn" || undefined}
					aria-hidden="true"
				>
					<CornerIllustration season={season} />
				</div>
			) : null}
			<div className="relative z-10 pt-7 lg:absolute lg:inset-s-12 lg:top-5 lg:pt-0">
				<Link
					to="/"
					aria-label={`${name} 首页`}
					className="inline-flex min-h-9 items-center rounded-md font-mono text-sm font-semibold uppercase tracking-[0.18em] text-foreground focus-visible:outline-2 focus-visible:outline-ring"
				>
					{name}
				</Link>
			</div>
			<div className="grid min-w-0 flex-1 lg:grid-cols-2">
				<div className="relative hidden min-h-152 flex-col justify-end pb-24 lg:flex">
					<blockquote className="max-w-52 space-y-4 text-[1.75rem] leading-relaxed text-balance lg:ms-10 xl:ms-18">
						<p>{tagline}</p>
						{settings?.github_username ? (
							<footer className="font-signature text-3xl text-muted-foreground">
								{settings.github_username}
							</footer>
						) : null}
					</blockquote>
				</div>
				<section
					aria-labelledby="auth-heading"
					className="relative flex min-w-0 items-start justify-center pt-10 pb-14 sm:pt-14 lg:items-center lg:justify-start lg:py-20 lg:pe-4 lg:ps-11 xl:ps-15"
				>
					<div className={`${styles.content} w-full max-w-100 space-y-7`}>
						<div className="space-y-2">
							<h1
								id="auth-heading"
								className="text-[2rem] leading-tight font-semibold tracking-tight"
							>
								{title}
							</h1>
							<div className="text-[0.9375rem] leading-relaxed text-muted-foreground">
								{description}
							</div>
						</div>
						{children}
					</div>
				</section>
			</div>
		</div>
	);
}
