import {
	Accordion,
	AccordionItem,
	Button,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@violet/ui";
import { useState } from "react";
import { useOwnChatBadges } from "../../api/appearance-queries";
import type { ChatAppearance } from "../../model/appearance";
import { AVATAR_CHARMS, AVATAR_FRAMES, BUBBLE_THEMES } from "../../model/appearance-catalog";
import { AppearanceOptionGrid } from "./AppearanceOptionGrid";
import { BadgeEquipGrid } from "./BadgeEquipGrid";
import styles from "./ChatAppearanceEditor.module.css";

/** 既有装饰与贴图主题仅在明确选中时更改,基础款不会清空其它字段。 */
export interface AppearanceDecorationsProps {
	userID: string;
	value: ChatAppearance;
	disabled: boolean;
	onFieldChange: (
		field: "avatar_frame_id" | "avatar_charm_id" | "bubble_theme_id",
		id: string,
	) => void;
	onBadgeChange: (ids: string[]) => void;
}

export function AppearanceDecorations({
	userID,
	value,
	disabled,
	onFieldChange,
	onBadgeChange,
}: AppearanceDecorationsProps) {
	const [open, setOpen] = useState(false);
	const badges = useOwnChatBadges(userID, open);
	return (
		<Accordion
			type="single"
			value={open ? "decorations" : ""}
			onValueChange={(value) => setOpen(value === "decorations")}
			className={styles.decorations}
		>
			<AccordionItem value="decorations" title="更多装饰" disabled={disabled}>
				{open && (
					<Tabs defaultValue="bubbles">
						<TabsList aria-label="更多装饰分类">
							<TabsTrigger value="bubbles">气泡主题</TabsTrigger>
							<TabsTrigger value="frames">头像框</TabsTrigger>
							<TabsTrigger value="charms">挂件</TabsTrigger>
							<TabsTrigger value="badges">徽章</TabsTrigger>
						</TabsList>
						<TabsContent value="bubbles">
							<AppearanceOptionGrid
								label="更多气泡主题"
								variant="bubble"
								options={BUBBLE_THEMES}
								value={value.bubble_theme_id}
								onChange={(id) => onFieldChange("bubble_theme_id", id)}
								disabled={disabled}
							/>
						</TabsContent>
						<TabsContent value="frames">
							<AppearanceOptionGrid
								label="头像框"
								variant="frame"
								options={AVATAR_FRAMES}
								value={value.avatar_frame_id}
								onChange={(id) => onFieldChange("avatar_frame_id", id)}
								disabled={disabled}
							/>
						</TabsContent>
						<TabsContent value="charms">
							<AppearanceOptionGrid
								label="挂件"
								variant="charm"
								options={AVATAR_CHARMS}
								value={value.avatar_charm_id}
								onChange={(id) => onFieldChange("avatar_charm_id", id)}
								disabled={disabled}
							/>
						</TabsContent>
						<TabsContent value="badges">
							<Button
								size="sm"
								variant="ghost"
								disabled={disabled || value.badge_ids.length === 0}
								onClick={() => onBadgeChange([])}
							>
								清空佩戴
							</Button>
							{badges.isError ? (
								<div
									role="alert"
									className="flex flex-wrap items-center gap-2 text-sm"
								>
									<span>无法读取已获得的徽章。</span>
									<Button
										size="sm"
										variant="outline"
										disabled={disabled}
										onClick={() => void badges.refetch()}
									>
										重试
									</Button>
								</div>
							) : (
								<>
									<p className="mb-2 text-xs text-muted-foreground">
										{badges.isPending
											? "正在读取徽章…"
											: "最多佩戴三枚,按选择顺序展示。"}
									</p>
									<BadgeEquipGrid
										ownedIDs={badges.data?.map((grant) => grant.badge_id)}
										value={value.badge_ids}
										onChange={onBadgeChange}
										disabled={disabled}
									/>
								</>
							)}
						</TabsContent>
					</Tabs>
				)}
			</AccordionItem>
		</Accordion>
	);
}
