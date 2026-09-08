import type { PersonaDetail } from "@entities/persona/model/types";
import { useSavePersona } from "@features/persona-editor/api/mutations";
import { useAdminPersona } from "@features/persona-editor/api/queries";
import { buildSavePersonaInput, toPersonaDocument } from "@features/persona-editor/model/document";
import type { PersonaDocument, PersonaSaveState } from "@features/persona-editor/model/types";
import { ApiError } from "@shared/api/error";
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UsePersonaDocumentOptions {
	id: string;
	canManage: boolean;
}

interface UsePersonaDocumentResult {
	document: PersonaDocument | null;
	detail: PersonaDetail | null;
	version: number;
	isLoading: boolean;
	error: Error | null;
	saveState: PersonaSaveState;
	updateDocument: (updater: (current: PersonaDocument) => PersonaDocument) => void;
	save: () => Promise<PersonaDetail | null>;
	reload: () => Promise<boolean>;
}

const blockNavigation = () => true;

function isSamePersonaDocument(current: PersonaDocument, next: PersonaDocument) {
	return (
		current === next ||
		(current.default_locale === next.default_locale &&
			current.avatar?.file_id === next.avatar?.file_id &&
			current.localizations === next.localizations)
	);
}

/** 管理人设的本地完整文档、显式保存、版本冲突与离开保护。 */
export function usePersonaDocument({
	id,
	canManage,
}: UsePersonaDocumentOptions): UsePersonaDocumentResult {
	const { data, isLoading, error, refetch } = useAdminPersona(id);
	const { mutateAsync } = useSavePersona(id);
	const [document, setDocument] = useState<PersonaDocument | null>(null);
	const documentRef = useRef<PersonaDocument | null>(null);
	const [serverVersion, setServerVersion] = useState(0);
	const [saveState, setSaveState] = useState<PersonaSaveState>("saved");
	const hydratedIdRef = useRef("");
	const changeSequenceRef = useRef(0);
	const saveInFlightRef = useRef(false);

	const hydrate = useCallback((detail: PersonaDetail) => {
		const nextDocument = toPersonaDocument(detail);
		documentRef.current = nextDocument;
		setDocument(nextDocument);
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

	const updateDocument = useCallback(
		(updater: (current: PersonaDocument) => PersonaDocument) => {
			if (!canManage || !documentRef.current) return;
			const nextDocument = updater(documentRef.current);
			if (isSamePersonaDocument(documentRef.current, nextDocument)) return;
			documentRef.current = nextDocument;
			setDocument(nextDocument);
			changeSequenceRef.current += 1;
			if (!saveInFlightRef.current) setSaveState("dirty");
		},
		[canManage],
	);

	const save = useCallback(async () => {
		const currentDocument = documentRef.current;
		if (!currentDocument || !canManage || saveState === "conflict" || saveInFlightRef.current) {
			return null;
		}
		const sequence = changeSequenceRef.current;
		saveInFlightRef.current = true;
		setSaveState("saving");
		try {
			const saved = await mutateAsync(buildSavePersonaInput(serverVersion, currentDocument));
			setServerVersion(saved.version);
			if (sequence === changeSequenceRef.current) {
				const savedDocument = toPersonaDocument(saved);
				documentRef.current = savedDocument;
				setDocument(savedDocument);
				setSaveState("saved");
				toast.success("人设档案已保存");
			} else {
				setSaveState("dirty");
			}
			return saved;
		} catch (saveError) {
			if (saveError instanceof ApiError && saveError.status === 409) {
				setSaveState("conflict");
			} else {
				setSaveState("error");
			}
			throw saveError;
		} finally {
			saveInFlightRef.current = false;
		}
	}, [canManage, mutateAsync, saveState, serverVersion]);

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
			return true;
		}
		toast.error("重新载入失败，本地修改仍然保留");
		return false;
	}, [hydrate, refetch]);

	return {
		document,
		detail: data ?? null,
		version: serverVersion,
		isLoading,
		error,
		saveState,
		updateDocument,
		save,
		reload,
	};
}
