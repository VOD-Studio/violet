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

const CATEGORIES = [
	{
		id: "frames",
		label: "头像框",
		intro: "环绕头像的圆形画框。",
		field: "avatar_frame_id",
		columns: 4 as const,
		options: AVATAR_FRAMES,
	},
	{
		id: "charms",
		label: "挂件",
		intro: "挂在头像右下角的小饰件。",
		field: "avatar_charm_id",
		columns: 6 as const,
		options: AVATAR_CHARMS,
	},
	{
		id: "bubbles",
		label: "气泡",
		intro: "消息气泡的底板皮肤，正文颜色随主题适配。",
		field: "bubble_theme_id",
		columns: 6 as const,
		options: BUBBLE_THEMES,
	},
	{
		id: "badges",
		label: "徽章",
		intro: "佩戴已获得的徽章，展示在发送者名旁，至多 3 枚。",
	},
] as const;

type CategoryID = (typeof CATEGORIES)[number]["id"];

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
	const [category, setCategory] = useState<CategoryID>("frames");
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
	const active = CATEGORIES.find((item) => item.id === category);
	const selectedValue = active && "field" in active ? draft[active.field] : undefined;
	const tabMark = (id: CategoryID) => {
		if (id === "badges") return draft.badge_ids.length > 0 ? `${draft.badge_ids.length}/3` : "";
		const selected = {
			frames: draft.avatar_frame_id,
			charms: draft.avatar_charm_id,
			bubbles: draft.bubble_theme_id,
		}[id];
		return selected ? "dot" : "";
	};
	return (
		<div className={styles.editor}>
			<ChatAppearancePreview appearance={draft} user={user} />
			<div className={styles.panel}>
				<div className={styles.tabs} role="tablist" aria-label="装饰分类">
					{CATEGORIES.map((item) => {
						const mark = tabMark(item.id);
						return (
							<button
								key={item.id}
								type="button"
								role="tab"
								className={styles.tab}
								aria-selected={category === item.id}
								onClick={() => setCategory(item.id)}
							>
								{item.label}
								{mark === "dot" ? (
									<span className={styles.tabDot} aria-hidden="true" />
								) : (
									mark && <span className={styles.tabCount}>{mark}</span>
								)}
							</button>
						);
					})}
				</div>
				<div className={styles.panelBody}>
					<div key={category} className={styles.panelAnimate}>
						{active && "field" in active ? (
							<>
								<div className={styles.panelTools}>
									<p className={styles.panelIntro}>{active.intro}</p>
									<button
										type="button"
										className={styles.clearButton}
										disabled={busy || !selectedValue}
										onClick={() => setField(active.field, "")}
									>
										不使用
									</button>
								</div>
								<AppearanceOptionGrid
									label={active.label}
									options={active.options}
									value={selectedValue ?? ""}
									onChange={(id) => setField(active.field, id)}
									columns={active.columns}
									disabled={busy}
								/>
							</>
						) : (
							<>
								<div className={styles.panelTools}>
									<p className={styles.panelIntro}>
										{active?.intro}
										{ownedBadges.data && (
											<span className={styles.legendHint}>
												{" "}
												已选 {draft.badge_ids.length}/3 · 已持有{" "}
												{ownedIDs?.length ?? 0}
											</span>
										)}
									</p>
									{draft.badge_ids.length > 0 && (
										<button
											type="button"
											className={styles.clearButton}
											disabled={busy}
											onClick={() => setBadgeIDs([])}
										>
											清空佩戴
										</button>
									)}
								</div>
								<BadgeEquipGrid
									ownedIDs={ownedIDs}
									value={draft.badge_ids}
									onChange={setBadgeIDs}
									disabled={busy}
								/>
							</>
						)}
					</div>
				</div>
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
