import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Modal } from "@shared/ui/modal";
import * as React from "react";
import { toast } from "sonner";
import type { FriendLinkAdminDTO, FriendLinkManualRequest } from "../model/types";

interface FriendLinkFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** 编辑时传入回显；手动添加省略 */
	initial?: FriendLinkAdminDTO;
	loading: boolean;
	onSubmit: (body: FriendLinkManualRequest) => void;
}

/**
 * 友链表弹窗 — 手动添加（直接 approved）与编辑共用
 *
 * 受控表单，打开时按 initial 重置回显（对齐 SubscriptionFormDialog 模式）。
 * 必填仅 name/url；URL 格式等其余校验交给后端（domain 聚合根），
 * 前端只做空值拦截。
 */
export function FriendLinkFormDialog({
	open,
	onOpenChange,
	title,
	initial,
	loading,
	onSubmit,
}: FriendLinkFormDialogProps) {
	const [name, setName] = React.useState("");
	const [url, setUrl] = React.useState("");
	const [avatarUrl, setAvatarUrl] = React.useState("");
	const [description, setDescription] = React.useState("");
	const [ownerName, setOwnerName] = React.useState("");
	const [linkbackUrl, setLinkbackUrl] = React.useState("");
	const [contactEmail, setContactEmail] = React.useState("");
	const [sortOrder, setSortOrder] = React.useState("0");

	React.useEffect(() => {
		if (open) {
			setName(initial?.name ?? "");
			setUrl(initial?.url ?? "");
			setAvatarUrl(initial?.avatar_url ?? "");
			setDescription(initial?.description ?? "");
			setOwnerName(initial?.owner_name ?? "");
			setLinkbackUrl(initial?.linkback_url ?? "");
			setContactEmail(initial?.contact_email ?? "");
			setSortOrder(String(initial?.sort_order ?? 0));
		}
	}, [open, initial]);

	const submit = () => {
		if (!name.trim()) {
			toast.error("请填写站点名称");
			return;
		}
		if (!url.trim()) {
			toast.error("请填写站点 URL");
			return;
		}
		onSubmit({
			name: name.trim(),
			url: url.trim(),
			avatar_url: avatarUrl.trim(),
			description: description.trim(),
			owner_name: ownerName.trim(),
			linkback_url: linkbackUrl.trim(),
			contact_email: contactEmail.trim(),
			sort_order: Number.parseInt(sortOrder, 10) || 0,
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
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="fl-name">
							站点名称 <span className="text-destructive">*</span>
						</Label>
						<Input
							id="fl-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={30}
							disabled={loading}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="fl-owner">站长称呼</Label>
						<Input
							id="fl-owner"
							value={ownerName}
							onChange={(e) => setOwnerName(e.target.value)}
							disabled={loading}
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="fl-url">
						站点 URL <span className="text-destructive">*</span>
					</Label>
					<Input
						id="fl-url"
						type="url"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="https://example.com"
						disabled={loading}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="fl-avatar">头像 URL</Label>
					<Input
						id="fl-avatar"
						type="url"
						value={avatarUrl}
						onChange={(e) => setAvatarUrl(e.target.value)}
						placeholder="留空则用首字符占位"
						disabled={loading}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="fl-desc">一句话描述</Label>
					<Input
						id="fl-desc"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						maxLength={80}
						disabled={loading}
					/>
				</div>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="fl-linkback">回链页地址</Label>
						<Input
							id="fl-linkback"
							type="url"
							value={linkbackUrl}
							onChange={(e) => setLinkbackUrl(e.target.value)}
							placeholder="对方挂本站链接的页面"
							disabled={loading}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="fl-email">联系邮箱</Label>
						<Input
							id="fl-email"
							type="email"
							value={contactEmail}
							onChange={(e) => setContactEmail(e.target.value)}
							placeholder="仅留存不公开"
							disabled={loading}
						/>
					</div>
				</div>
				<div className="space-y-2">
					<Label htmlFor="fl-sort">排序值</Label>
					<Input
						id="fl-sort"
						type="number"
						value={sortOrder}
						onChange={(e) => setSortOrder(e.target.value)}
						disabled={loading}
					/>
					<p className="text-muted-foreground text-xs">越小越靠前，同权重按创建时间</p>
				</div>
			</div>
		</Modal>
	);
}
