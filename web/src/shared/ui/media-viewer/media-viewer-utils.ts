export function formatMediaSize(bytes?: number): string | null {
	if (bytes === undefined) return null;
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function isImmersiveMedia(mimeType: string): boolean {
	return (
		mimeType.startsWith("image/") ||
		mimeType.startsWith("video/") ||
		mimeType.startsWith("audio/")
	);
}

export function reservesArrowKeys(mimeType: string): boolean {
	return mimeType.startsWith("video/") || mimeType.startsWith("audio/");
}
