import { RichTextEditor } from "@features/editor";
import type { PersonaDraftLocalization } from "@features/persona-editor/model/types";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/base/card";
import { localeLabel } from "@shared/ui/locale-switcher";
import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { PersonaFactsSection } from "./PersonaFactsSection";
import { PersonaIdentitySection } from "./PersonaIdentitySection";
import { PersonaImagesSection } from "./PersonaImagesSection";

interface PersonaLocalizationEditorProps {
	personaId: string;
	localization: PersonaDraftLocalization;
	canManage: boolean;
	disabled: boolean;
	onChange: (updater: (current: PersonaDraftLocalization) => PersonaDraftLocalization) => void;
}

/** 集中编辑单个语言版本，切换语言时保留各版本独立草稿。 */
export function PersonaLocalizationEditor({
	personaId,
	localization,
	canManage,
	disabled,
	onChange,
}: PersonaLocalizationEditorProps) {
	return (
		<>
			<PersonaIdentitySection
				localization={localization}
				disabled={disabled}
				onChange={(patch) =>
					onChange((current) => ({ ...current, ...patch, is_complete: false }))
				}
			/>
			<PersonaFactsSection
				facts={localization.facts}
				disabled={disabled}
				onChange={(facts) =>
					onChange((current) => ({ ...current, facts, is_complete: false }))
				}
			/>

			<Card>
				<CardHeader>
					<CardTitle>设定正文 · {localeLabel(localization.locale)}</CardTitle>
					<p className="text-xs leading-relaxed text-muted-foreground">
						使用 Markdown 编写当前语言的完整人物设定；编辑器底栏可直接导入 .md 文件。
					</p>
				</CardHeader>
				<CardContent>
					{canManage ? (
						<div className={disabled ? "pointer-events-none opacity-70" : undefined}>
							<RichTextEditor
								key={`${personaId}:${localization.locale}`}
								value={localization.content_md}
								onChange={(content_md) =>
									onChange((current) => ({
										...current,
										content_md,
										is_complete: false,
									}))
								}
								contentType="markdown"
								placeholder="导入设定文档，或从人物锚点开始书写…"
								exportName={`${localization.name || "persona"}-${localization.locale}`}
								minHeight={520}
								autoGrow
							/>
						</div>
					) : localization.content_html ? (
						<ArticleContent
							content={localization.content_html}
							className="prose prose-neutral max-w-none dark:prose-invert"
						/>
					) : (
						<p className="py-8 text-center text-sm text-muted-foreground">
							正文尚未填写
						</p>
					)}
				</CardContent>
			</Card>

			<PersonaImagesSection
				images={localization.images}
				disabled={disabled}
				onChange={(images) =>
					onChange((current) => ({ ...current, images, is_complete: false }))
				}
			/>
		</>
	);
}
