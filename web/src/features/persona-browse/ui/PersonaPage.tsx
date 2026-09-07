import { useActivePersona } from "@entities/persona/api/queries";
import type { PersonaPublicImage } from "@entities/persona/model/types";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { contentImageSrcSet, contentImageUrl } from "@shared/lib/image-url";
import { ImagePreview } from "@shared/ui/image-preview";
import { LocaleSwitcher } from "@shared/ui/locale-switcher";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { useState } from "react";
import styles from "./PersonaPage.module.css";

interface LightboxState {
	open: boolean;
	index: number;
	trigger: HTMLButtonElement | null;
}

const CLOSED_LIGHTBOX: LightboxState = { open: false, index: 0, trigger: null };
const DISPLAY_IMAGE_WIDTH = 2048;
const DISPLAY_SRCSET_WIDTHS = [640, 1024, 1600, 2048] as const;

interface PersonaPageProps {
	locale: string;
	onLocaleChange: (locale: string, defaultLocale: string) => void;
}

function imageAlt(image: PersonaPublicImage, index: number, name: string): string {
	return image.alt_text || `${name} · 第 ${index + 1} 张设定图`;
}

/** 当前公开人设的艺术图开场、长文档与有序设定图。 */
export function PersonaPage({ locale, onLocaleChange }: PersonaPageProps) {
	const { data: persona, isLoading, isError } = useActivePersona(locale);
	const articleImages = useArticleImagePreview();
	const [lightbox, setLightbox] = useState<LightboxState>(CLOSED_LIGHTBOX);

	if (isLoading) {
		return (
			<main className={styles.page}>
				<div className={styles.loading} role="status">
					正在载入人设档案
				</div>
			</main>
		);
	}

	if (isError) {
		return (
			<main className={styles.page}>
				<div className={styles.empty} role="alert">
					<div>
						<h1>暂时无法读取人设档案</h1>
						<p>请稍后刷新页面重试。</p>
					</div>
				</div>
			</main>
		);
	}

	if (!persona) {
		return (
			<main className={styles.page}>
				<div className={styles.empty} role="status">
					<div>
						<h1>人设档案尚未公开</h1>
						<p>当前没有已激活的角色资料。</p>
					</div>
				</div>
			</main>
		);
	}

	const heroImage = persona.images[0];
	const referenceImages = persona.images.slice(1);
	const allImageUrls = persona.images.map((image) => image.url);
	const allThumbnails = persona.images.map((image) => image.thumbnail || image.url);
	const allAlts = persona.images.map((image, index) => imageAlt(image, index, persona.name));

	return (
		<main className={styles.page}>
			<section className={styles.hero} aria-labelledby="persona-name">
				{heroImage ? (
					<button
						type="button"
						className={styles.visualButton}
						onClick={(event) =>
							setLightbox({ open: true, index: 0, trigger: event.currentTarget })
						}
						aria-label={`预览 ${allAlts[0]}`}
					>
						<img
							srcSet={contentImageSrcSet(heroImage.url, DISPLAY_SRCSET_WIDTHS)}
							sizes="(min-width: 1280px) 44rem, (min-width: 1024px) 54vw, calc(100vw - 2.5rem)"
							src={contentImageUrl(heroImage.url, { width: DISPLAY_IMAGE_WIDTH })}
							alt={allAlts[0]}
							width={heroImage.width > 0 ? heroImage.width : undefined}
							height={heroImage.height > 0 ? heroImage.height : undefined}
							className={styles.heroImage}
							loading="eager"
							fetchPriority="high"
						/>
					</button>
				) : null}

				<div className={styles.identity}>
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
					<h1 id="persona-name" className={styles.title}>
						{persona.name}
					</h1>
					{persona.subtitle ? (
						<p className={styles.subtitle}>{persona.subtitle}</p>
					) : null}
					{persona.summary ? <p className={styles.summary}>{persona.summary}</p> : null}
					{persona.facts.length > 0 ? (
						<dl className={styles.facts}>
							{persona.facts.map((fact) => (
								<div className={styles.fact} key={fact.label}>
									<dt>{fact.label}</dt>
									<dd>{fact.value}</dd>
								</div>
							))}
						</dl>
					) : null}
				</div>
			</section>

			{persona.content_html ? (
				<section className={styles.contentSection} aria-labelledby="persona-story-title">
					<div
						className={styles.contentInner}
						data-article-content
						onClick={articleImages.bind.onClick}
						onKeyDown={articleImages.bind.onKeyDown}
					>
						<h2 id="persona-story-title" className={styles.sectionTitle}>
							人物设定
						</h2>
						<ArticleContent
							content={persona.content_html}
							className={`${styles.article} prose prose-neutral max-w-none dark:prose-invert`}
						/>
					</div>
					{articleImages.preview}
				</section>
			) : null}

			{referenceImages.length > 0 ? (
				<section
					className={styles.referenceSection}
					aria-labelledby="persona-gallery-title"
				>
					<div className={styles.referenceInner}>
						<h2 id="persona-gallery-title" className={styles.sectionTitle}>
							设定图集
						</h2>
						<ol className={styles.referenceList}>
							{referenceImages.map((image, referenceIndex) => {
								const imageIndex = referenceIndex + 1;
								return (
									<li className={styles.referenceItem} key={image.url}>
										<figure>
											<button
												type="button"
												className={styles.referenceButton}
												onClick={(event) =>
													setLightbox({
														open: true,
														index: imageIndex,
														trigger: event.currentTarget,
													})
												}
												aria-label={`预览 ${allAlts[imageIndex]}`}
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
													alt={allAlts[imageIndex]}
													width={
														image.width > 0 ? image.width : undefined
													}
													height={
														image.height > 0 ? image.height : undefined
													}
													className={styles.referenceImage}
													loading="lazy"
												/>
											</button>
											{image.caption ? (
												<figcaption className={styles.caption}>
													{image.caption}
												</figcaption>
											) : null}
										</figure>
									</li>
								);
							})}
						</ol>
					</div>
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
