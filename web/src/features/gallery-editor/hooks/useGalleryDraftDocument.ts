import type { GalleryDetail, GalleryItem } from "@entities/gallery/model/types";
import { useSaveGalleryDraft } from "@features/gallery-editor/api/mutations";
import { useGalleryDraft } from "@features/gallery-editor/api/queries";
import { buildSaveGalleryInput } from "@features/gallery-editor/model/draft";
import { ApiError } from "@shared/api/error";
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface GalleryDraftDocument {
	title: string;
	summary: string;
	items: GalleryItem[];
}

export type GalleryDraftSaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

interface UseGalleryDraftDocumentOptions {
	id: string;
	canManage: boolean;
}

interface UseGalleryDraftDocumentResult {
	draft: GalleryDraftDocument | null;
	isLoading: boolean;
	error: Error | null;
	saveState: GalleryDraftSaveState;
	updateDraft: (updater: (current: GalleryDraftDocument) => GalleryDraftDocument) => void;
	save: (explicit: boolean) => Promise<void>;
	reload: () => Promise<void>;
}

const AUTO_SAVE_DELAY = 1000;
const blockNavigation = () => true;

function toDraftDocument(detail: GalleryDetail): GalleryDraftDocument {
	return {
		title: detail.title,
		summary: detail.summary,
		items: detail.items,
	};
}

/** 管理工作稿的本地文档、乐观版本、防抖保存与冲突恢复。 */
export function useGalleryDraftDocument({
	id,
	canManage,
}: UseGalleryDraftDocumentOptions): UseGalleryDraftDocumentResult {
	const { data, isLoading, error, refetch } = useGalleryDraft(id);
	const { mutateAsync } = useSaveGalleryDraft(id);
	const [draft, setDraft] = useState<GalleryDraftDocument | null>(null);
	const [serverVersion, setServerVersion] = useState(0);
	const [saveState, setSaveState] = useState<GalleryDraftSaveState>("saved");
	const hydratedIdRef = useRef("");
	const changeSequenceRef = useRef(0);
	const saveInFlightRef = useRef(false);

	const hydrate = useCallback((detail: GalleryDetail) => {
		setDraft(toDraftDocument(detail));
		setServerVersion(detail.version);
		setSaveState("saved");
		changeSequenceRef.current = 0;
		hydratedIdRef.current = detail.id;
	}, []);

	useEffect(() => {
		if (!data) return;
		if (
			hydratedIdRef.current !== data.id ||
			(saveState === "saved" && data.version > serverVersion)
		) {
			hydrate(data);
		}
	}, [data, hydrate, saveState, serverVersion]);

	const updateDraft = useCallback(
		(updater: (current: GalleryDraftDocument) => GalleryDraftDocument) => {
			setDraft((current) => (current ? updater(current) : current));
			changeSequenceRef.current += 1;
			if (!saveInFlightRef.current) {
				setSaveState("dirty");
			}
		},
		[],
	);

	const save = useCallback(
		async (explicit: boolean) => {
			if (!draft || !canManage || saveState === "conflict" || saveInFlightRef.current) return;
			if (saveState === "saved" && !explicit) return;

			const sequence = changeSequenceRef.current;
			saveInFlightRef.current = true;
			setSaveState("saving");
			try {
				const saved = await mutateAsync(
					buildSaveGalleryInput(serverVersion, draft.title, draft.summary, draft.items),
				);
				setServerVersion(saved.version);
				if (sequence === changeSequenceRef.current) {
					setDraft(toDraftDocument(saved));
					setSaveState("saved");
					if (explicit) toast.success("工作稿已保存");
				} else {
					setSaveState("dirty");
				}
			} catch (saveError) {
				if (saveError instanceof ApiError && saveError.status === 409) {
					setSaveState("conflict");
					toast.error("工作稿已在其他窗口更新，请重新载入");
				} else {
					setSaveState("error");
					if (explicit) {
						toast.error(saveError instanceof Error ? saveError.message : "保存失败");
					}
				}
			} finally {
				saveInFlightRef.current = false;
			}
		},
		[canManage, draft, mutateAsync, saveState, serverVersion],
	);

	useEffect(() => {
		if (saveState !== "dirty" || !canManage) return;
		const timer = window.setTimeout(() => void save(false), AUTO_SAVE_DELAY);
		return () => window.clearTimeout(timer);
	}, [canManage, save, saveState]);

	const hasPendingChanges = saveState !== "saved";
	useBlocker({
		shouldBlockFn: blockNavigation,
		enableBeforeUnload: hasPendingChanges,
		disabled: !hasPendingChanges,
	});

	const reload = useCallback(async () => {
		const result = await refetch();
		if (result.isSuccess && result.data) {
			hydrate(result.data);
			return;
		}
		toast.error("重新载入失败，本地修改仍然保留");
	}, [hydrate, refetch]);

	return { draft, isLoading, error, saveState, updateDraft, save, reload };
}
