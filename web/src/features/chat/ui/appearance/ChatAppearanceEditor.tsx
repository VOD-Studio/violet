import { Button } from "@shared/ui/base/button";
import { useState } from "react";
import { fetchOwnAppearance } from "../../api/appearance";
import { useOwnChatBadges, useSaveChatAppearance } from "../../api/appearance-queries";
import { appearanceErrorMessage, sameAppearance } from "../../lib/appearance";
import type { ChatAppearanceState } from "../../model/appearance";
import {
	AVATAR_CHARMS,
	AVATAR_FRAMES,
	BUBBLE_THEMES,
	EMPTY_APPEARANCE,
} from "../../model/appearance-catalog";
import type { ChatUser } from "../../model/types";
import { AppearanceOptionGrid } from "./AppearanceOptionGrid";
import { BadgeEquipGrid } from "./BadgeEquipGrid";
import styles from "./ChatAppearanceEditor.module.css";
import { ChatAppearancePreview } from "./ChatAppearancePreview";

export interface ChatAppearanceEditorProps {
	/** 草稿的起点:服务端已加载的快照。 */
	initial: ChatAppearanceState;
	/** 登录用户:限定变更范围,并用真实头像预览。 */
	user: ChatUser;
	/** 仅在保存成功或显式取消后调用。 */
	onClose: () => void;
}

/** 后台轮询绝不替换草稿;冲突须显式重载才更新。 */
export function ChatAppearanceEditor({ initial, user, onClose }: ChatAppearanceEditorProps) {
	const [base, setBase] = useState(initial);
	const [draft, setDraft] = useState(initial);
	const [error, setError] = useState("");
	const [reloading, setReloading] = useState(false);
	const save = useSaveChatAppearance(user.id);
	const ownedBadges = useOwnChatBadges(user.id, true);
	const ownedIDs = ownedBadges.data?.map((grant) => grant.badge_id);
	const busy = save.isPending || reloading;
	const changed = !sameAppearance(base, draft);
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
	const reload = async () => {
		setReloading(true);
		setError("");
		try {
			const current = await fetchOwnAppearance();
			setBase(current);
			setDraft(current);
		} catch (err) {
			setError(appearanceErrorMessage(err));
		} finally {
			setReloading(false);
		}
	};
	const submit = async () => {
		setError("");
		try {
			await save.mutateAsync(draft);
			onClose();
		} catch (err) {
			setError(appearanceErrorMessage(err));
		}
	};
	return (
		<div className={styles.editor}>
			<ChatAppearancePreview appearance={draft} user={user} />
			<div className={styles.catalog}>
				<AppearanceOptionGrid
					label="头像框"
					options={AVATAR_FRAMES}
					value={draft.avatar_frame_id}
					onChange={(id) => setField("avatar_frame_id", id)}
					disabled={busy}
				/>
				<AppearanceOptionGrid
					label="头像角标挂件"
					options={AVATAR_CHARMS}
					value={draft.avatar_charm_id}
					onChange={(id) => setField("avatar_charm_id", id)}
					disabled={busy}
				/>
				<AppearanceOptionGrid
					label="消息气泡"
					options={BUBBLE_THEMES}
					value={draft.bubble_theme_id}
					onChange={(id) => setField("bubble_theme_id", id)}
					disabled={busy}
				/>
				<BadgeEquipGrid
					ownedIDs={ownedIDs}
					value={draft.badge_ids}
					onChange={setBadgeIDs}
					disabled={busy}
				/>
			</div>
			{error && (
				<div role="alert" className={styles.error}>
					{error}
					<Button
						size="sm"
						variant="outline"
						disabled={busy}
						onClick={() => {
							void reload();
						}}
					>
						重新加载
					</Button>
				</div>
			)}
			<footer className={styles.actions}>
				<Button
					variant="ghost"
					disabled={busy}
					onClick={() =>
						setDraft({ ...EMPTY_APPEARANCE, badge_ids: [], revision: base.revision })
					}
				>
					恢复默认
				</Button>
				<span className={styles.actionSpacer} />
				<Button variant="outline" disabled={busy} onClick={onClose}>
					取消
				</Button>
				<Button
					disabled={busy || !changed}
					onClick={() => {
						void submit();
					}}
				>
					{save.isPending ? "保存中…" : "保存外观"}
				</Button>
			</footer>
		</div>
	);
}
