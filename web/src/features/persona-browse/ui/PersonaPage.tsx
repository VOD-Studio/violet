import { useActivePersona } from "@entities/persona/api/queries";
import {
	personaAvatarAlt,
	personaImageAlt,
	personaPageLabels,
	splitPersonaDisplayName,
} from "@features/persona-browse/model/presentation";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { contentImageSrcSet, contentImageUrl } from "@shared/lib/image-url";
import { ImagePreview } from "@shared/ui/image-preview";
import { LocaleSwitcher } from "@shared/ui/locale-switcher";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { RuaLoading } from "@widgets/PersonaMotion";
import { ArrowDown } from "lucide-react";
import { useState } from "react";
import styles from "./PersonaPage.module.css";

interface LightboxState {
	open: boolean;
	index: number;
	trigger: HTMLButtonElement | null;
}

interface PersonaPageProps {
	locale: string;
	onLocaleChange: (locale: string, defaultLocale: string) => void;
}

const CLOSED_LIGHTBOX: LightboxState = { open: false, index: 0, trigger: null };
const DISPLAY_IMAGE_WIDTH = 2048;
const DISPLAY_SRCSET_WIDTHS = [640, 1024, 1600, 2048] as const;
const AVATAR_SRCSET_WIDTHS = [320, 480, 640, 960] as const;

/** 当前公开人设的阅读型档案、长文设定与有序图集。 */
export function PersonaPage({ locale, onLocaleChange }: PersonaPageProps) {
	const { data: persona, isLoading, isError } = useActivePersona(locale);
	const articleImages = useArticleImagePreview();
	const [lightbox, setLightbox] = useState<LightboxState>(CLOSED_LIGHTBOX);

	if (isLoading) {
		return (
			<main className={styles.page}>
				<RuaLoading label="正在整理人设档案…" />
			</main>
		);
	}

	if (isError) {
		return (
			<main className={`${styles.page} ${styles.empty}`}>
				<div>
					<h1>人设档案暂时无法抵达</h1>
					<p>请稍后再试。</p>
				</div>
			</main>
		);
	}

	if (!persona) {
		return (
			<main className={`${styles.page} ${styles.empty}`}>
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
		<main className={styles.page}>
			<section className={styles.hero} aria-labelledby="persona-name">
				<div className={styles.heroGlow} aria-hidden />
				<div className={styles.heroInner}>
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
								<img
									srcSet={contentImageSrcSet(heroAsset.url, AVATAR_SRCSET_WIDTHS)}
									sizes="(min-width: 1024px) 24rem, (min-width: 640px) 21rem, calc(100vw - 5rem)"
									src={contentImageUrl(heroAsset.url, { width: 960 })}
									alt={heroAlt}
									width={heroAsset.width > 0 ? heroAsset.width : undefined}
									height={heroAsset.height > 0 ? heroAsset.height : undefined}
									className={styles.heroImage}
									loading="eager"
									fetchPriority="high"
								/>
							</button>
							<figcaption>
								<span>PORTRAIT</span>
								<span>{persona.locale}</span>
							</figcaption>
						</figure>
					) : null}

					<div className={styles.identity}>
						<div className={styles.identityTopline}>
							<p className={styles.eyebrow}>PERSONA / 00</p>
							{persona.available_locales.length > 1 ? (
								<LocaleSwitcher
									locales={persona.available_locales}
									value={persona.locale}
									onValueChange={(nextLocale) => {
										setLightbox(CLOSED_LIGHTBOX);
										onLocaleChange(nextLocale, persona.default_locale);
									}}
									ariaLabel="切换人设语言"
									className={styles.localeSwitcher}
								/>
							) : null}
						</div>

						<h1 id="persona-name" className={styles.title} aria-label={persona.name}>
							<span>{name.primary}</span>
							{name.alias ? <em>{name.alias}</em> : null}
							<i aria-hidden>.</i>
						</h1>
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
						<p>01 / PROFILE</p>
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

			{persona.content_html ? (
				<section className={styles.contentSection} aria-labelledby="persona-story-title">
					<header className={styles.sectionHeader}>
						<p>02 / NOTES</p>
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

			{galleryImages.length > 0 ? (
				<section
					className={styles.referenceSection}
					aria-labelledby="persona-gallery-title"
				>
					<header className={styles.sectionHeader}>
						<p>03 / VISUALS</p>
						<h2 id="persona-gallery-title">{labels.gallery}</h2>
					</header>
					<ol className={styles.referenceList}>
						{galleryImages.map((image, index) => {
							const previewIndex = index + 1;
							return (
								<li className={styles.referenceItem} key={image.url}>
									<figure>
										<button
											type="button"
											className={styles.referenceButton}
											onClick={(event) =>
												setLightbox({
													open: true,
													index: previewIndex,
													trigger: event.currentTarget,
												})
											}
											aria-label={`预览 ${galleryAlts[index]}`}
										>
											<img
												srcSet={contentImageSrcSet(
													image.url,
													DISPLAY_SRCSET_WIDTHS,
												)}
												sizes="(min-width: 1280px) 68rem, calc(100vw - 2.5rem)"
												src={contentImageUrl(image.url, {
													width: DISPLAY_IMAGE_WIDTH,
												})}
												alt={galleryAlts[index]}
												width={image.width > 0 ? image.width : undefined}
												height={image.height > 0 ? image.height : undefined}
												className={styles.referenceImage}
												loading="lazy"
											/>
										</button>
										<figcaption className={styles.caption}>
											<span>{String(index + 1).padStart(2, "0")}</span>
											{image.caption ? <p>{image.caption}</p> : null}
										</figcaption>
									</figure>
								</li>
							);
						})}
					</ol>
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
		</main>
	);
}
