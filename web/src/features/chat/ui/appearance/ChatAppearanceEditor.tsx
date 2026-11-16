import { Button, SheetBody, SheetFooter } from "@violet/ui";
import { useState } from "react";
import { fetchOwnAppearance } from "../../api/appearance";
import { useSaveChatAppearance } from "../../api/appearance-queries";
import { appearanceErrorMessage, sameAppearance } from "../../lib/appearance";
import type { ChatAppearanceState } from "../../model/appearance";
import { useChatBackgroundStore } from "../../model/appearance-background";
import { EMPTY_APPEARANCE } from "../../model/appearance-catalog";
import type { ChatUser } from "../../model/types";
import { AppearanceBasics } from "./AppearanceBasics";
import { AppearanceDecorations } from "./AppearanceDecorations";
import styles from "./ChatAppearanceEditor.module.css";
import { ChatAppearancePreview } from "./ChatAppearancePreview";

/** 每次打开使用已保存快照初始化;后台轮询不替换正在编辑的草稿。 */
export interface ChatAppearanceEditorProps {
	initial: ChatAppearanceState;
	user: ChatUser;
	onClose: () => void;
	onBusyChange: (busy: boolean) => void;
}

export function ChatAppearanceEditor({
	initial,
	user,
	onClose,
	onBusyChange,
}: ChatAppearanceEditorProps) {
	const [base, setBase] = useState(initial);
	const [draft, setDraft] = useState(initial);
	const savedBackground = useChatBackgroundStore(
		(state) => state.backgrounds[user.id] ?? "paper",
	);
	const setBackground = useChatBackgroundStore((state) => state.setBackground);
	const [background, setDraftBackground] = useState(savedBackground);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const save = useSaveChatAppearance(user.id);
	const changed = !sameAppearance(base, draft) || background !== savedBackground;
	const setField = (
		key: "avatar_frame_id" | "avatar_charm_id" | "bubble_theme_id",
		value: string,
	) => {
		setDraft((old) => ({ ...old, [key]: value }));
		setError("");
	};
	const setBadgeIDs = (ids: string[]) => {
		setDraft((old) => ({ ...old, badge_ids: ids }));
		setError("");
	};
	const setOperationBusy = (value: boolean) => {
		setBusy(value);
		onBusyChange(value);
	};
	const reload = async () => {
		setOperationBusy(true);
		setError("");
		try {
			const current = await fetchOwnAppearance();
			setBase(current);
			setDraft(current);
		} catch (err) {
			setError(appearanceErrorMessage(err));
		} finally {
			setOperationBusy(false);
		}
	};
	const submit = async () => {
		if (busy || !changed) {
			return;
		}
		setOperationBusy(true);
		setError("");
		try {
			if (!sameAppearance(base, draft)) {
				await save.mutateAsync(draft);
			}
			setBackground(user.id, background);
			onClose();
		} catch (err) {
			setError(appearanceErrorMessage(err));
		} finally {
			setOperationBusy(false);
		}
	};
	return (
		<>
			<SheetBody aria-busy={busy} className={styles.body}>
				<div className={styles.columns}>
					<div className={styles.controls}>
						<AppearanceBasics
							themeId={draft.bubble_theme_id}
							background={background}
							disabled={busy}
							onThemeChange={(id) => setField("bubble_theme_id", id)}
							onBackgroundChange={setDraftBackground}
						/>
						<AppearanceDecorations
							userID={user.id}
							value={draft}
							disabled={busy}
							onFieldChange={setField}
							onBadgeChange={setBadgeIDs}
						/>
					</div>
					<ChatAppearancePreview appearance={draft} background={background} user={user} />
				</div>
				{error && (
					<div role="alert" className={styles.error}>
						<span>{error}</span>
						<Button
							size="sm"
							variant="outline"
							disabled={busy}
							onClick={() => void reload()}
						>
							重新加载
						</Button>
					</div>
				)}
			</SheetBody>
			<SheetFooter>
				<Button
					variant="ghost"
					className="mr-auto"
					disabled={busy}
					onClick={() => {
						setDraft({ ...EMPTY_APPEARANCE, badge_ids: [], revision: base.revision });
						setDraftBackground("paper");
						setError("");
					}}
				>
					恢复默认
				</Button>
				<Button variant="outline" disabled={busy} onClick={onClose}>
					取消
				</Button>
				<Button
					disabled={busy || !changed}
					loading={save.isPending}
					onClick={() => void submit()}
				>
					保存
				</Button>
			</SheetFooter>
		</>
	);
}
