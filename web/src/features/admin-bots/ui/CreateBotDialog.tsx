import { useCreateBot } from "@features/admin-bots/api/queries";
import type { BotDTO } from "@features/admin-bots/model/types";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Modal } from "@shared/ui/modal";
import * as React from "react";
import { toast } from "sonner";

// 与后端 domain/user 的 usernamePattern 同形：前端先拦一次给即时反馈，
// 真判仍以后端为准（这里放宽会直接收到 400，不会造成越权）。
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

interface CreateBotDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 注册成功：回传含一次性明文 token 的 Bot */
	onCreated: (bot: BotDTO) => void;
}

export function CreateBotDialog({ open, onOpenChange, onCreated }: CreateBotDialogProps) {
	const create = useCreateBot();
	const [name, setName] = React.useState("");
	const [username, setUsername] = React.useState("");

	React.useEffect(() => {
		if (open) {
			setName("");
			setUsername("");
		}
	}, [open]);

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		const trimmedName = name.trim();
		const trimmedUsername = username.trim();
		if (!trimmedName) {
			toast.error("请填写显示名");
			return;
		}
		if (!USERNAME_PATTERN.test(trimmedUsername)) {
			toast.error("用户名需为 3-32 位字母、数字、下划线或连字符");
			return;
		}
		create.mutate(
			{ name: trimmedName, username: trimmedUsername },
			{
				onSuccess: (bot) => {
					onOpenChange(false);
					onCreated(bot);
				},
			},
		);
	};

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="注册 Bot"
			description="注册即创建同名的虚拟用户，外部程序以它的名义收发消息"
			footer={
				<>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						取消
					</Button>
					<Button type="submit" form="create-bot-form" disabled={create.isPending}>
						注册并签发 token
					</Button>
				</>
			}
		>
			<form id="create-bot-form" className="space-y-4" onSubmit={submit}>
				<div className="space-y-1.5">
					<Label htmlFor="bot-name">显示名</Label>
					<Input
						id="bot-name"
						value={name}
						maxLength={32}
						placeholder="Saber"
						onChange={(e) => setName(e.target.value)}
					/>
					<p className="text-xs text-muted-foreground">
						最长 32 个字符，同时作为虚拟用户的展示名
					</p>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="bot-username">用户名</Label>
					<Input
						id="bot-username"
						value={username}
						placeholder="saber"
						className="font-mono"
						onChange={(e) => setUsername(e.target.value)}
					/>
					<p className="text-xs text-muted-foreground">
						3-32 位字母、数字、下划线或连字符，全站唯一；@提及用它寻址
					</p>
				</div>
			</form>
		</Modal>
	);
}
