import type { GalleryItem } from "@entities/gallery/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/base/tabs";
import { ImagePreview } from "@shared/ui/image-preview";
import { PhotoStack } from "@shared/ui/photo-stack";
import { Images } from "lucide-react";
import { useState } from "react";

interface GalleryDraftPreviewProps {
	title: string;
	summary: string;
	items: GalleryItem[];
}

interface LightboxState {
	open: boolean;
	index: number;
	trigger: HTMLButtonElement | null;
}

const LIGHTBOX_CLOSED: LightboxState = { open: false, index: 0, trigger: null };
const PREVIEW_IMAGE_WIDTH = 1024;

function itemAlt(item: GalleryItem, index: number, title: string): string {
	return (
		item.alt_text_override ||
		item.asset_alt_text ||
		(title ? `${title} · 第 ${index + 1} 张` : `图集图片 ${index + 1}`)
	);
}

/** 使用当前工作稿预览浏览流、详情排版与灯箱，不读取公开版本。 */
export function GalleryDraftPreview({ title, summary, items }: GalleryDraftPreviewProps) {
	const [lightbox, setLightbox] = useState<LightboxState>(LIGHTBOX_CLOSED);

	if (items.length === 0) {
		return (
			<div className="flex aspect-3/4 items-center justify-center rounded-xl border border-dashed bg-muted/30 text-muted-foreground">
				<div className="text-center">
					<Images className="mx-auto mb-2 size-8" />
					<p className="text-sm">选择图片后可在这里预览</p>
				</div>
			</div>
		);
	}

	const alts = items.map((item, index) => itemAlt(item, index, title));

	return (
		<>
			<Tabs defaultValue="feed">
				<TabsList className="grid w-full grid-cols-2">
					<TabsTrigger value="feed">浏览流</TabsTrigger>
					<TabsTrigger value="detail">详情与灯箱</TabsTrigger>
				</TabsList>
				<TabsContent value="feed" className="mt-4">
					<PhotoStack
						images={items.map((item, index) => ({
							src: item.thumbnail || item.url,
							alt: alts[index],
						}))}
						footer={
							<div>
								<p className="truncate font-medium">{title || "未命名图集"}</p>
								{summary ? (
									<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
										{summary}
									</p>
								) : null}
							</div>
						}
					/>
				</TabsContent>
				<TabsContent value="detail" className="mt-4">
					<div className="max-h-[70dvh] space-y-6 overflow-y-auto rounded-xl border bg-background p-4">
						<header className="space-y-2 text-center">
							<h2 className="font-mono font-bold text-xl">{title || "未命名图集"}</h2>
							{summary ? (
								<p className="text-muted-foreground text-sm">{summary}</p>
							) : null}
						</header>
						<ol className="space-y-6">
							{items.map((item, index) => (
								<li key={item.file_id}>
									<figure className="space-y-2">
										<button
											type="button"
											onClick={(event) =>
												setLightbox({
													open: true,
													index,
													trigger: event.currentTarget,
												})
											}
											className="block w-full cursor-zoom-in rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
										>
											<img
												src={contentImageUrl(item.url, {
													width: PREVIEW_IMAGE_WIDTH,
												})}
												alt={alts[index]}
												width={item.width > 0 ? item.width : undefined}
												height={item.height > 0 ? item.height : undefined}
												className="h-auto max-h-100 w-full rounded-lg object-contain"
											/>
										</button>
										{item.caption ? (
											<figcaption className="text-center text-muted-foreground text-xs">
												{item.caption}
											</figcaption>
										) : null}
									</figure>
								</li>
							))}
						</ol>
					</div>
				</TabsContent>
			</Tabs>
			<ImagePreview
				open={lightbox.open}
				onClose={() => setLightbox((state) => ({ ...state, open: false }))}
				images={items.map((item) => item.url)}
				thumbnails={items.map((item) => item.thumbnail || item.url)}
				alts={alts}
				currentIndex={lightbox.index}
				onIndexChange={(index) => setLightbox((state) => ({ ...state, index }))}
				triggerElement={lightbox.trigger}
			/>
		</>
	);
}
