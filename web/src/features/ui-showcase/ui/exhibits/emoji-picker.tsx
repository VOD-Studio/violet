import {
	type EmojiPickerItem,
	EmojiPickerPanel,
	type EmojiPickerPanelProps,
	UploadTile,
} from "@violet/ui";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";
import { createEmojiPickerDemoGroups, INITIAL_RECENT } from "./emoji-picker-data";

const INITIAL_GROUPS: Partial<Record<string, string>> = {
	large: "large",
	unavailable: "large",
	text: "text",
	recent: "recent",
	collection: "collection",
	empty: "collection",
};

function EmojiPickerSpecimen({ state }: ExhibitRenderProps) {
	const [group, setGroup] = useState(INITIAL_GROUPS[state] ?? "small");
	const [recent, setRecent] = useState<readonly EmojiPickerItem[]>(INITIAL_RECENT);
	const pendingRecent = useRef<readonly EmojiPickerItem[]>(INITIAL_RECENT);
	const [uploaded, setUploaded] = useState<EmojiPickerItem[]>([]);
	const [inserted, setInserted] = useState("");
	const [recovered, setRecovered] = useState(false);
	const [uploadError, setUploadError] = useState("");
	const uploadInput = useRef<HTMLInputElement>(null);
	let status: EmojiPickerPanelProps["status"] = "ready";
	if (!recovered && state === "loading") {
		status = "loading";
	} else if (!recovered && state === "error") {
		status = "error";
	}
	const groups = useMemo(
		() =>
			createEmojiPickerDemoGroups({
				state,
				recent,
				uploaded,
				uploadAction: (
					<UploadTile
						aria-label="上传表情"
						title="在本次展品会话中读取本机图片"
						onClick={() => uploadInput.current?.click()}
					/>
				),
			}),
		[state, recent, uploaded],
	);

	const handleGroupChange = (nextGroup: string) => {
		if (nextGroup === "recent" && group !== "recent") {
			setRecent(pendingRecent.current);
		}
		setGroup(nextGroup);
	};
	const handleSelect = (item: EmojiPickerItem) => {
		setInserted((value) => value + item.placeholder);
		// 浏览最近页时先不挪动格子，再次进入该页才应用新的顺序。
		pendingRecent.current = [
			item,
			...pendingRecent.current.filter((entry) => entry.id !== item.id),
		].slice(0, 16);
	};
	const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = "";
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result !== "string") {
				return;
			}
			const src = reader.result;
			const id = `local-${crypto.randomUUID()}`;
			const name = file.name.replace(/\.[^./]+$/, "");
			setUploaded((items) => [
				...items,
				{ id, name, placeholder: `[${name}:${id}]`, content: <img src={src} alt="" /> },
			]);
			setUploadError("");
		};
		reader.onerror = () => setUploadError("图片没有读取成功，请重新选择。");
		reader.readAsDataURL(file);
	};

	return (
		<div className="flex h-full w-full flex-col gap-3 p-4">
			<input
				ref={uploadInput}
				type="file"
				accept="image/png,image/jpeg,image/gif,image/webp"
				className="hidden"
				aria-label="选择表情图片"
				onChange={handleFileSelection}
			/>
			<EmojiPickerPanel
				groups={groups}
				activeGroup={group}
				onGroupChange={handleGroupChange}
				status={status}
				errorMessage="当前连接不可用，可以重新加载。"
				onRetry={() => setRecovered(true)}
				onSelect={handleSelect}
			/>
			<output className="w-full truncate text-xs text-muted-foreground" aria-live="polite">
				{uploadError || inserted || "选择表情，在这里查看插入的原文"}
			</output>
		</div>
	);
}

function EmojiPickers({ state }: ExhibitRenderProps) {
	return <EmojiPickerSpecimen key={state} state={state} />;
}

export const emojiPickerExhibit: Exhibit = {
	id: "emoji-picker",
	name: "表情选择器",
	units: ["emoji-picker"],
	zone: "shelf",
	category: "form",
	footprint: { width: 372, height: 364 },
	states: [
		{ id: "small", label: "小表情" },
		{ id: "large", label: "大表情" },
		{ id: "text", label: "颜文字" },
		{ id: "recent", label: "最近使用" },
		{ id: "collection", label: "收藏与上传" },
		{ id: "empty", label: "收藏为空" },
		{ id: "loading", label: "加载中" },
		{ id: "error", label: "加载失败" },
		{ id: "unavailable", label: "不可用与已回应" },
	],
	Render: EmojiPickers,
};
