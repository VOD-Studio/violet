import {
	type CreateSubscriptionRequest,
	intervalLabel,
	SUBSCRIPTION_INTERVALS,
	type SubscriptionDTO,
	type SubscriptionInterval,
} from "@features/admin-subscriptions/model/types";
import { Button } from "@shared/ui/base/button";
import { Checkbox } from "@shared/ui/base/checkbox";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shared/ui/base/select";
import { Modal } from "@shared/ui/modal";
import * as React from "react";
import { toast } from "sonner";

interface SubscriptionFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	initial?: SubscriptionDTO;
	loading: boolean;
	onSubmit: (body: CreateSubscriptionRequest) => void;
}

export function SubscriptionFormDialog({
	open,
	onOpenChange,
	title,
	initial,
	loading,
	onSubmit,
}: SubscriptionFormDialogProps) {
	const [feedUrl, setFeedUrl] = React.useState("");
	const [subTitle, setSubTitle] = React.useState("");
	const [interval, setInterval] = React.useState<SubscriptionInterval>("daily");
	const [autoPublish, setAutoPublish] = React.useState(false);
	const [canonicalOverride, setCanonicalOverride] = React.useState("");
	const [tagsInput, setTagsInput] = React.useState("");

	React.useEffect(() => {
		if (open) {
			setFeedUrl(initial?.feed_url ?? "");
			setSubTitle(initial?.title ?? "");
			setInterval(initial?.interval ?? "daily");
			setAutoPublish(initial?.auto_publish ?? false);
			setCanonicalOverride(initial?.canonical_override ?? "");
			setTagsInput(initial?.tags.join(", ") ?? "");
		}
	}, [open, initial]);

	const submit = () => {
		if (!feedUrl.trim()) {
			toast.error("请填写 feed URL");
			return;
		}
		const tags = tagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);
		onSubmit({
			feed_url: feedUrl.trim(),
			title: subTitle.trim() || undefined,
			interval,
			auto_publish: autoPublish,
			canonical_override: canonicalOverride.trim() || undefined,
			tags: tags.length > 0 ? tags : undefined,
		});
	};

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title={title}
			footer={
				<>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={loading}
					>
						取消
					</Button>
					<Button onClick={submit} disabled={loading}>
						{loading ? "保存中…" : "保存"}
					</Button>
				</>
			}
		>
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="sub-feed-url">
						Feed URL <span className="text-destructive">*</span>
					</Label>
					<Input
						id="sub-feed-url"
						value={feedUrl}
						onChange={(e) => setFeedUrl(e.target.value)}
						placeholder="https://example.com/feed.xml"
						disabled={loading || !!initial}
					/>
					{initial && (
						<p className="text-muted-foreground text-xs">feed URL 创建后不可修改</p>
					)}
				</div>
				<div className="space-y-2">
					<Label htmlFor="sub-title">标题</Label>
					<Input
						id="sub-title"
						value={subTitle}
						onChange={(e) => setSubTitle(e.target.value)}
						placeholder="留空用 feed 自带标题"
						disabled={loading}
					/>
				</div>
				<div className="space-y-2">
					<Label>抓取频率</Label>
					<Select
						value={interval}
						onValueChange={(v) => setInterval(v as SubscriptionInterval)}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SUBSCRIPTION_INTERVALS.map((i) => (
								<SelectItem key={i} value={i}>
									{intervalLabel(i)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="sub-canonical">canonical 覆盖</Label>
					<Input
						id="sub-canonical"
						value={canonicalOverride}
						onChange={(e) => setCanonicalOverride(e.target.value)}
						placeholder="留空用 entry.link"
						disabled={loading}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="sub-tags">标签</Label>
					<Input
						id="sub-tags"
						value={tagsInput}
						onChange={(e) => setTagsInput(e.target.value)}
						placeholder="逗号分隔，如：转载, 技术"
						disabled={loading}
					/>
				</div>
				<label
					htmlFor="sub-auto-publish"
					className="flex cursor-pointer items-center gap-2"
				>
					<Checkbox
						id="sub-auto-publish"
						checked={autoPublish}
						onCheckedChange={(v) => setAutoPublish(v === true)}
						disabled={loading}
					/>
					<Label htmlFor="sub-auto-publish" className="cursor-pointer">
						自动发布（关闭则抓取后建草稿）
					</Label>
				</label>
			</div>
		</Modal>
	);
}
