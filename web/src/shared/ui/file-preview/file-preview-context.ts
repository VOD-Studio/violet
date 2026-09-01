import { createContext, useContext } from "react";

export type FilePreviewVariant = "inline" | "viewer";

export const FilePreviewVariantContext = createContext<FilePreviewVariant>("inline");

export function useFilePreviewVariant(): FilePreviewVariant {
	return useContext(FilePreviewVariantContext);
}
