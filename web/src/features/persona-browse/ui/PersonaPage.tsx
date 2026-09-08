import { useActivePersona } from "@entities/persona/api/queries";
import {
	personaAvatarAlt,
	personaImageAlt,
	personaPageLabels,
	splitPersonaDisplayName,
} from "@features/persona-browse/model/presentation";
import { useArticleImagePreview } from "@shared/hooks/use-article-image-preview";
import { contentImageSrcSet, contentImageUrl } from "@shared/lib/image-url";
import { BackToTop } from "@shared/ui/back-to-top";
import { ImagePixelReveal } from "@shared/ui/image-pixel-reveal";
import { ImagePreview } from "@shared/ui/image-preview";
import { localeLabel } from "@shared/ui/locale-switcher";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { PhotoStack } from "@shared/ui/photo-stack";
import { RuaLoading } from "@widgets/PersonaMotion";
import { ArrowDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { PersonaLocaleTabs } from "./PersonaLocaleTabs";
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
const PLATE_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * 人设公开档案页：
 *
 * 融合日系高级画报与艺术展册排版，提供肖像立绘、基本指标、左右交错设定展板与深度长文。
 */
export function PersonaPage({ locale, onLocaleChange }: PersonaPageProps) {
	const { data: persona, isPending, isError, isPlaceholderData } = useActivePersona(locale);
	const articleImages = useArticleImagePreview();
	const [lightbox, setLightbox] = useState<LightboxState>(CLOSED_LIGHTBOX);
	const reduceMotion = useReducedMotion();
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
			{/* --- Hero: 画报封面非对称构图 --- */}
			<section className={styles.hero} aria-labelledby="persona-name">
				<div className={styles.heroGlow} aria-hidden />

				<div className={styles.heroInner} key={persona.locale}>
					{/* 左侧：肖像立绘卡片 */}
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
									className={styles.heroImageContainer}
									imgClassName={styles.heroImage}
									loading="eager"
								/>
							</button>
							<figcaption className={styles.portraitCaption}>
								<span className={styles.portraitIndex}>PORTRAIT</span>
								<span className={styles.portraitLocale}>
									{localeLabel(persona.locale)}
								</span>
							</figcaption>
						</figure>
					) : null}

					{/* 右侧：标题排印、自白书与元信息 */}
					<div className={styles.identity}>
						{persona.available_locales.length > 1 ? (
							<div className={styles.identityTopline}>
								<PersonaLocaleTabs
									locales={persona.available_locales}
									value={persona.locale}
									onValueChange={(nextLocale) => {
										setLightbox(CLOSED_LIGHTBOX);
										onLocaleChange(nextLocale, persona.default_locale);
									}}
								/>
							</div>
						) : null}

						<h1 id="persona-name" className={styles.title} aria-label={persona.name}>
							<span className={styles.titlePrimary}>{name.primary}</span>
							{name.alias ? (
								<span className={styles.titleAlias}>{name.alias}</span>
							) : null}
						</h1>

						{persona.subtitle ? (
							<div className={styles.subtitleRow}>
								<span className={styles.subtitleBullet} aria-hidden />
								<p className={styles.subtitle}>{persona.subtitle}</p>
							</div>
						) : null}

						{persona.summary ? (
							<blockquote className={styles.summaryBlock}>
								<p>{persona.summary}</p>
							</blockquote>
						) : null}

						<div className={styles.heroActions}>
							<a className={styles.continueLink} href="#persona-profile">
								<span>{labels.continueReading}</span>
								<ArrowDown className={styles.continueIcon} aria-hidden />
							</a>
						</div>
					</div>
				</div>
			</section>

			{/* --- 01 / PROFILE: 角色档案与核心指标 --- */}
			{persona.facts.length > 0 ? (
				<section
					className={styles.profileSection}
					id="persona-profile"
					aria-labelledby="profile-title"
				>
					<header className={styles.sectionHeader}>
						<div className={styles.sectionTopline}>
							<span className={styles.sectionIndex} aria-hidden>
								01
							</span>
							<p className={styles.sectionKicker}>PROFILE // 档案指标</p>
							<div className={styles.sectionRule} aria-hidden />
						</div>
						<h2 id="profile-title">{labels.profile}</h2>
					</header>

					<dl className={styles.specLedger}>
						{persona.facts.map((fact) => (
							<div className={styles.specRow} key={fact.label}>
								<dt className={styles.specKey}>{fact.label}</dt>
								<dd className={styles.specValue}>{fact.value}</dd>
							</div>
						))}
					</dl>
				</section>
			) : null}

			{/* --- 02 / VISUALS: 左右交错艺术设定展板 --- */}
			{galleryImages.length > 0 ? (
				<section
					className={styles.gallerySection}
					id="persona-gallery"
					aria-labelledby="persona-gallery-title"
				>
					<header className={styles.sectionHeader}>
						<div className={styles.sectionTopline}>
							<span className={styles.sectionIndex} aria-hidden>
								02
							</span>
							<p className={styles.sectionKicker}>VISUAL SPEC // 设定资料</p>
							<div className={styles.sectionRule} aria-hidden />
						</div>
						<h2 id="persona-gallery-title">{labels.gallery}</h2>
					</header>

					<div className={styles.galleryStage}>
						<PhotoStack
							loading="lazy"
							aspectClass="aspect-5/3"
							overlay={false}
							className={styles.photoStack}
							images={galleryImages.map((image, index) => ({
								src: image.url,
								alt: galleryAlts[index],
							}))}
							footer={
								<div className={styles.stackFooter}>
									<span className={styles.stackIndex}>
										FIG. 01–{String(galleryImages.length).padStart(2, "0")}
									</span>
									<p>叠起成册，铺开成墙</p>
								</div>
							}
							onImageOpen={(index) =>
								setLightbox({ open: true, index: index + 1, trigger: null })
							}
							renderExpanded={() => (
								<ol className={styles.plateList}>
									{galleryImages.map((image, index) => {
										const previewIndex = index + 1;
										const isEven = index % 2 === 1;
										return (
											<motion.li
												className={`${styles.plateItem} ${isEven ? styles.plateEven : styles.plateOdd}`}
												key={image.url}
												initial={{ opacity: 0, y: 28 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{
													opacity: 0,
													y: -18,
													transition: reduceMotion
														? { duration: 0 }
														: { duration: 0.3, ease: PLATE_EASE },
												}}
												transition={
													reduceMotion
														? { duration: 0 }
														: {
																duration: 0.45,
																ease: PLATE_EASE,
																delay: index * 0.05,
															}
												}
											>
												<article className={styles.plateFrame}>
													<div className={styles.plateHeader}>
														<span className={styles.plateIndex}>
															PLATE //{" "}
															{String(previewIndex).padStart(2, "0")}
														</span>
														{image.caption ? (
															<span
																className={styles.plateCaptionLabel}
															>
																{image.caption}
															</span>
														) : null}
													</div>

													<button
														type="button"
														className={styles.plateButton}
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
															width={
																image.width > 0
																	? image.width
																	: undefined
															}
															height={
																image.height > 0
																	? image.height
																	: undefined
															}
															className={styles.plateImage}
															loading="lazy"
														/>
													</button>
												</article>
											</motion.li>
										);
									})}
								</ol>
							)}
						/>
					</div>
				</section>
			) : null}

			{/* --- 03 / NOTES: 长文设定与世界观物语 --- */}
			{persona.content_html ? (
				<section className={styles.contentSection} aria-labelledby="persona-story-title">
					<header className={styles.sectionHeader}>
						<div className={styles.sectionTopline}>
							<span className={styles.sectionIndex} aria-hidden>
								03
							</span>
							<p className={styles.sectionKicker}>CHRONICLE // 人物设定</p>
							<div className={styles.sectionRule} aria-hidden />
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

			{/* 全屏大图灯箱预览 */}
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

			{/* 悬浮返回顶部按钮 */}
			<BackToTop />
		</main>
	);
}
