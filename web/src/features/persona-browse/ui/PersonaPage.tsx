import { useActivePersona } from "@entities/persona/api/queries";
import {
	personaAvatarAlt,
	personaImageAlt,
	personaPageLabels,
	splitPersonaDisplayName,
} from "@features/persona-browse/model/presentation";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { contentImageUrl } from "@shared/lib/image-url";
import { BackToTop } from "@shared/ui/back-to-top";
import { ImagePixelReveal } from "@shared/ui/image-pixel-reveal";
import { ImagePreview } from "@shared/ui/image-preview";
import { localeLabel } from "@shared/ui/locale-switcher";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { PhotoStack } from "@shared/ui/photo-stack";
import { RuaLoading } from "@widgets/PersonaMotion";
import { ArrowDown } from "lucide-react";
import { useState } from "react";
import { PersonaLocaleTabs } from "./PersonaLocaleTabs";
import styles from "./PersonaPage.module.css";

interface LightboxState {
	open: boolean;
	index: number;
	trigger: HTMLButtonElement | null;
}

const CLOSED_LIGHTBOX: LightboxState = { open: false, index: 0, trigger: null };

interface PersonaPageProps {
	locale: string;
	onLocaleChange: (locale: string, defaultLocale: string) => void;
}

/** 当前公开人设的阅读型档案、可翻阅设定图集与长文设定。 */
export function PersonaPage({ locale, onLocaleChange }: PersonaPageProps) {
	const { data: persona, isPending, isError, isPlaceholderData } = useActivePersona(locale);
	const articleImages = useArticleImagePreview();
	const [lightbox, setLightbox] = useState<LightboxState>(CLOSED_LIGHTBOX);

	if (isPending) {
		return (
			<main className={`public-surface ${styles.page}`}>
				<RuaLoading label="正在整理人设档案…" />
			</main>
		);
	}

	if (isError) {
		return (
			<main className={`public-surface ${styles.page} ${styles.empty}`}>
				<div>
					<h1>人设档案暂时无法抵达</h1>
					<p>请稍后再试。</p>
				</div>
			</main>
		);
	}

	if (!persona) {
		return (
			<main className={`public-surface ${styles.page} ${styles.empty}`}>
				<div>
					<h1>人设档案尚未公开</h1>
					<p>当前没有已激活的角色资料。</p>
				</div>
			</main>
		);
	}
	const labels = personaPageLabels(persona.locale);
	const name = splitPersonaDisplayName(persona.name);
	const heroAsset = persona.avatar ?? persona.images[0] ?? null;
	const galleryImages = persona.avatar ? persona.images : persona.images.slice(1);
	const heroAlt = persona.avatar
		? personaAvatarAlt(persona.avatar, persona.name)
		: persona.images[0]
			? personaImageAlt(persona.images[0], 0, persona.name)
			: "";
	const galleryAlts = galleryImages.map((image, index) =>
		personaImageAlt(image, persona.avatar ? index : index + 1, persona.name),
	);
	const previewImages = heroAsset ? [heroAsset, ...galleryImages] : [];
	const allImageUrls = previewImages.map((image) => image.url);
	const allThumbnails = previewImages.map((image) => image.thumbnail || image.url);
	const allAlts = heroAsset ? [heroAlt, ...galleryAlts] : [];

	return (
		<main
			className={`public-surface ${styles.page}`}
			data-stale={isPlaceholderData || undefined}
		>
			<section className={styles.hero} aria-labelledby="persona-name">
				<div className={styles.heroGlow} aria-hidden />
				{/* key=档案语言：新语言数据到达时整段重挂载，入场编排随之重演一遍 */}
				<div className={styles.heroInner} key={persona.locale}>
					{heroAsset ? (
						<figure className={styles.portraitFigure}>
							<button
								type="button"
								className={styles.visualButton}
								onClick={(event) =>
									setLightbox({
										open: true,
										index: 0,
										trigger: event.currentTarget,
									})
								}
								aria-label={`预览 ${heroAlt}`}
							>
								<ImagePixelReveal
									src={contentImageUrl(heroAsset.url, { width: 960 })}
									alt={heroAlt}
									variant="random"
									tileSize={40}
									duration={0.32}
									spreadMs={380}
									replayOnHover
									className={styles.heroImage}
									imgClassName={styles.heroImageImg}
									loading="eager"
								/>
							</button>
							<figcaption>
								<span>PORTRAIT</span>
								<span>{localeLabel(persona.locale)}</span>
							</figcaption>
						</figure>
					) : null}

					<div className={styles.identity}>
						<div className={styles.identityTopline}>
							<p className={styles.eyebrow}>PERSONA FILE</p>
							{persona.available_locales.length > 1 ? (
								<PersonaLocaleTabs
									locales={persona.available_locales}
									value={persona.locale}
									onValueChange={(nextLocale) => {
										setLightbox(CLOSED_LIGHTBOX);
										onLocaleChange(nextLocale, persona.default_locale);
									}}
								/>
							) : null}
						</div>

						<h1 id="persona-name" className={styles.title} aria-label={persona.name}>
							<span className={styles.titleName} aria-hidden="true">
								{[...name.primary].map((glyph, index) => (
									<span
										key={`${glyph}-${index}`}
										style={{ "--glyph-i": index } as React.CSSProperties}
									>
										{glyph}
									</span>
								))}
							</span>
						</h1>
						{name.alias ? (
							<p className={styles.titleAlias}>
								<span className={styles.titleAliasDash} aria-hidden />
								{name.alias}
							</p>
						) : null}
						{persona.subtitle ? (
							<p className={styles.subtitle}>{persona.subtitle}</p>
						) : null}
						{persona.summary ? (
							<blockquote className={styles.summary}>
								<p>{persona.summary}</p>
							</blockquote>
						) : null}
						<a className={styles.continueLink} href="#persona-profile">
							{labels.continueReading}
							<ArrowDown aria-hidden />
						</a>
					</div>
				</div>
			</section>

			{persona.facts.length > 0 ? (
				<section
					className={styles.profileSection}
					id="persona-profile"
					aria-labelledby="profile-title"
				>
					<header className={styles.sectionHeader}>
						<div className={styles.sectionTopline}>
							<span className={styles.sectionIndex} aria-hidden="true">
								01
							</span>
							<p className={styles.sectionKicker}>PROFILE</p>
							<span className={styles.sectionRule} aria-hidden />
						</div>
						<h2 id="profile-title">{labels.profile}</h2>
					</header>
					<dl className={styles.facts}>
						{persona.facts.map((fact) => (
							<div className={styles.fact} key={fact.label}>
								<dt>{fact.label}</dt>
								<dd>{fact.value}</dd>
							</div>
						))}
					</dl>
				</section>
			) : null}

			{galleryImages.length > 0 ? (
				<section
					className={styles.referenceSection}
					aria-labelledby="persona-gallery-title"
				>
					<header className={styles.sectionHeader}>
						<div className={styles.sectionTopline}>
							<span className={styles.sectionIndex} aria-hidden="true">
								02
							</span>
							<p className={styles.sectionKicker}>VISUALS</p>
							<span className={styles.sectionRule} aria-hidden />
						</div>
						<h2 id="persona-gallery-title">{labels.gallery}</h2>
					</header>
					<div className={styles.referenceStage}>
						<PhotoStack
							loading="lazy"
							aspectClass="aspect-4/3"
							overlay={false}
							className={styles.photoStack}
							images={galleryImages.map((image, index) => ({
								src: image.thumbnail || image.url,
								alt: galleryAlts[index],
							}))}
							footer={
								<p className={styles.stackFooter}>
									<span>
										FIG. 01–{String(galleryImages.length).padStart(2, "0")}
									</span>
									拖动卡片翻阅设定资料，点击放大原图
								</p>
							}
							onImageOpen={(index) =>
								setLightbox({ open: true, index: index + 1, trigger: null })
							}
						/>
					</div>
				</section>
			) : null}

			{persona.content_html ? (
				<section className={styles.contentSection} aria-labelledby="persona-story-title">
					<header className={styles.sectionHeader}>
						<div className={styles.sectionTopline}>
							<span className={styles.sectionIndex} aria-hidden="true">
								03
							</span>
							<p className={styles.sectionKicker}>NOTES</p>
							<span className={styles.sectionRule} aria-hidden />
						</div>
						<h2 id="persona-story-title">{labels.story}</h2>
					</header>
					<div
						className={styles.contentInner}
						data-article-content
						onClick={articleImages.bind.onClick}
						onKeyDown={articleImages.bind.onKeyDown}
					>
						<ArticleContent
							content={persona.content_html}
							className={`${styles.article} prose prose-neutral max-w-none dark:prose-invert`}
						/>
					</div>
					{articleImages.preview}
				</section>
			) : null}

			<ImagePreview
				open={lightbox.open}
				onClose={() => setLightbox((state) => ({ ...state, open: false }))}
				images={allImageUrls}
				thumbnails={allThumbnails}
				alts={allAlts}
				currentIndex={lightbox.index}
				onIndexChange={(index) => setLightbox((state) => ({ ...state, index }))}
				triggerElement={lightbox.trigger}
			/>
			<BackToTop />
		</main>
	);
}
