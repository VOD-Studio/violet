import { Button } from "@shared/ui/base/button";
import { Award, CircleUserRound, Gem, MessageSquare } from "lucide-react";
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
import type { OptionVariant } from "./AppearanceOptionGrid";
import { AppearanceOptionGrid } from "./AppearanceOptionGrid";
import { BadgeEquipGrid } from "./BadgeEquipGrid";
import styles from "./ChatAppearanceEditor.module.css";
import { ChatAppearancePreview } from "./ChatAppearancePreview";

const CATEGORIES = [
	{
		id: "frames",
		label: "头像框",
		icon: CircleUserRound,
		variant: "frame" as OptionVariant,
		field: "avatar_frame_id",
		options: AVATAR_FRAMES,
	},
	{
		id: "charms",
		label: "挂件",
		icon: Gem,
		variant: "charm" as OptionVariant,
		field: "avatar_charm_id",
		options: AVATAR_CHARMS,
	},
	{
		id: "bubbles",
		label: "气泡",
		icon: MessageSquare,
		variant: "bubble" as OptionVariant,
		field: "bubble_theme_id",
		options: BUBBLE_THEMES,
	},
	{
		id: "badges",
		label: "徽章",
		icon: Award,
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
	const [category, setCategory] = useState<CategoryID>("bubbles");
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
	return (
		<div className={styles.editor}>
			<div className={styles.body}>
				<aside className={styles.sideRail}>
					<ChatAppearancePreview appearance={draft} user={user} />
					<nav className={styles.categoryNav} aria-label="外观分类">
						{CATEGORIES.map((item) => {
							const Icon = item.icon;
							return (
								<button
									key={item.id}
									type="button"
									className={styles.categoryButton}
									aria-pressed={category === item.id}
									onClick={() => setCategory(item.id)}
								>
									<Icon aria-hidden="true" className="size-5" />
									<span>{item.label}</span>
								</button>
							);
						})}
					</nav>
				</aside>
				<section className={styles.shelf} aria-label="选择聊天外观">
					{/* key 换分类即重挂内容,由 panelAnimate 播放一次轻淡入 */}
					<div key={category} className={styles.panelAnimate}>
						{category === "badges" && draft.badge_ids.length > 0 && (
							<div className={styles.shelfTools}>
								<button
									type="button"
									className={styles.clearButton}
									disabled={busy}
									onClick={() => setBadgeIDs([])}
								>
									清空佩戴
								</button>
							</div>
						)}
						{active && "field" in active ? (
							<AppearanceOptionGrid
								label={active.label}
								variant={active.variant}
								options={active.options}
								value={selectedValue ?? ""}
								onChange={(id) => setField(active.field, id)}
								disabled={busy}
							/>
						) : (
							<BadgeEquipGrid
								ownedIDs={ownedIDs}
								value={draft.badge_ids}
								onChange={setBadgeIDs}
								disabled={busy}
							/>
						)}
					</div>
				</section>
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
				<div className={styles.actionContent}>
					<Button
						variant="ghost"
						disabled={busy}
						onClick={() =>
							setDraft({
								...EMPTY_APPEARANCE,
								badge_ids: [],
								revision: base.revision,
							})
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
						{save.isPending ? "保存中…" : "保存"}
					</Button>
				</div>
			</footer>
		</div>
	);
}
