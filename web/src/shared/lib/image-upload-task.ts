export interface UploadedImage {
	id: string;
	url: string;
	width: number;
	height: number;
	size: number;
}

/** 上传任务可由输入框和提交后的预览共同持有；最后一个持有者释放本地 URL。 */
export interface ImageUploadTask {
	file: File;
	previewURL: string;
	readonly result: UploadedImage | undefined;
	readonly progress: number;
	/** 返回可重复调用的释放函数。 */
	retain: () => () => void;
	/** 复用进行中的上传和成功结果；失败后再次调用会重试。 */
	upload: (onProgress?: (percent: number) => void) => Promise<UploadedImage>;
}

export interface ImageUploadReference {
	/** 当前正文占位符的 ID，上传完成前为本地 ID。 */
	id: string;
	task: ImageUploadTask;
}

export function createImageUploadTask(
	file: File,
	upload: (file: File, onProgress: (percent: number) => void) => Promise<UploadedImage>,
): ImageUploadTask {
	const previewURL = URL.createObjectURL(file);
	let holders = 0;
	let result: UploadedImage | undefined;
	let pending: Promise<UploadedImage> | undefined;
	let progress = 0;
	const listeners = new Set<(percent: number) => void>();
	return {
		file,
		previewURL,
		get result() {
			return result;
		},
		get progress() {
			return progress;
		},
		retain() {
			holders++;
			let released = false;
			return () => {
				if (released) return;
				released = true;
				if (--holders === 0) URL.revokeObjectURL(previewURL);
			};
		},
		async upload(onProgress) {
			if (result) return result;
			if (onProgress) {
				listeners.add(onProgress);
				onProgress(progress);
			}
			try {
				pending ??= upload(file, (percent) => {
					progress = percent;
					for (const listener of listeners) listener(percent);
				})
					.then((image) => {
						result = image;
						return image;
					})
					.finally(() => {
						pending = undefined;
					});
				return await pending;
			} finally {
				if (onProgress) listeners.delete(onProgress);
			}
		},
	};
}
