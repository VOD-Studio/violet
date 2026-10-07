import { useChunkedUpload } from "@features/upload/hooks/use-chunked-upload";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MAX_TWEET_IMAGES } from "../model/types";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** 发布器中的本地图片及上传进度。 */
export interface TweetComposerImage {
	id: number;
	url: string;
	progress: number;
	status: "uploading" | "done" | "error";
	preview: string;
}

interface TweetComposerImages {
	images: TweetComposerImage[];
	uploading: boolean;
	doneUrls: string[];
	addFiles: (files: FileList | File[] | null) => Promise<void>;
	removeImage: (id: number) => void;
	clearImages: () => void;
}

/** 顺序上传推文图片；移除、发布成功和卸载时释放本地预览。 */
export function useTweetComposerImages(): TweetComposerImages {
	const [images, setImages] = useState<TweetComposerImage[]>([]);
	const imagesRef = useRef(images);
	imagesRef.current = images;
	const id = useRef(0);
	const batch = useRef(false);
	const mounted = useRef(true);
	const previews = useRef(new Set<string>());
	const { uploadFile } = useChunkedUpload({ purpose: "tweet" });

	const release = (preview: string) => {
		if (previews.current.delete(preview)) URL.revokeObjectURL(preview);
	};
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			for (const preview of previews.current) URL.revokeObjectURL(preview);
			previews.current.clear();
		};
	}, []);

	const addFiles = async (files: FileList | File[] | null) => {
		if (!files?.length) return;
		if (batch.current) {
			toast.error("请等待当前图片上传完成");
			return;
		}
		const slots = MAX_TWEET_IMAGES - imagesRef.current.length;
		if (slots <= 0) {
			toast.error(`最多 ${MAX_TWEET_IMAGES} 张图`);
			return;
		}
		if (files.length > slots)
			toast.error(`最多 ${MAX_TWEET_IMAGES} 张图，已添加前 ${slots} 张`);
		batch.current = true;
		try {
			for (const file of Array.from(files).slice(0, slots)) {
				if (!mounted.current) break;
				if (!file.type.startsWith("image/")) {
					toast.error(`${file.name} 不是图片`);
					continue;
				}
				if (file.size > MAX_IMAGE_SIZE) {
					toast.error(`${file.name} 超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
					continue;
				}
				const localId = ++id.current;
				const preview = URL.createObjectURL(file);
				previews.current.add(preview);
				setImages((prev) => [
					...prev,
					{ id: localId, url: "", progress: 0, status: "uploading", preview },
				]);
				try {
					const result = await uploadFile(file, (progress) => {
						if (mounted.current)
							setImages((prev) =>
								prev.map((image) =>
									image.id === localId
										? { ...image, progress: progress.percent }
										: image,
								),
							);
					});
					if (mounted.current)
						setImages((prev) =>
							prev.map((image) =>
								image.id === localId
									? { ...image, status: "done", url: result.url }
									: image,
							),
						);
					release(preview);
				} catch (error) {
					if (!mounted.current) break;
					setImages((prev) =>
						prev.map((image) =>
							image.id === localId ? { ...image, status: "error" } : image,
						),
					);
					toast.error(error instanceof Error ? error.message : "图片上传失败");
				}
			}
		} finally {
			batch.current = false;
		}
	};
	const removeImage = (localId: number) => {
		const image = imagesRef.current.find((item) => item.id === localId);
		if (image) release(image.preview);
		setImages((prev) => prev.filter((item) => item.id !== localId));
	};
	const clearImages = () => {
		for (const preview of previews.current) URL.revokeObjectURL(preview);
		previews.current.clear();
		setImages([]);
	};
	return {
		images,
		uploading: images.some((image) => image.status === "uploading"),
		doneUrls: images.filter((image) => image.status === "done").map((image) => image.url),
		addFiles,
		removeImage,
		clearImages,
	};
}
