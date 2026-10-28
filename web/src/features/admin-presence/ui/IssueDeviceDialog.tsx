import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
} from "@violet/ui";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useIssuePresenceDevice } from "../api/queries";
import { ingestUrl } from "../lib/ingest-url";
import type { IssuedPresenceDevice } from "../model/types";
import { CopyField } from "./CopyField";

/**
 * 签发设备凭证：先填设备名称，成功后只展示一次凭证与上报地址。
 *
 * @remarks 关闭对话框即丢弃凭证明文，不写入任何缓存。
 */
export function IssueDeviceDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const issue = useIssuePresenceDevice();
	const [name, setName] = useState("");
	const [issued, setIssued] = useState<IssuedPresenceDevice | null>(null);

	const close = (next: boolean) => {
		if (!next) {
			setName("");
			setIssued(null);
			issue.reset();
		}
		onOpenChange(next);
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		try {
			setIssued(await issue.mutateAsync(name.trim()));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "签发失败");
		}
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent className="sm:max-w-lg">
				{issued ? (
					<>
						<DialogHeader>
							<DialogTitle>「{issued.device.display_name}」的凭证已签发</DialogTitle>
							<DialogDescription>
								凭证只显示这一次，关闭后无法再查看。丢失了就撤销这台设备，重新签发。
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div className="space-y-1.5">
								<p className="text-sm font-medium">上报地址</p>
								<CopyField
									label="上报地址"
									value={ingestUrl(issued.ingest_path, window.location)}
								/>
							</div>
							<div className="space-y-1.5">
								<p className="text-sm font-medium">设备凭证</p>
								<CopyField label="设备凭证" value={issued.token} />
							</div>
							<ol className="list-decimal space-y-1 pl-7 text-sm text-muted-foreground">
								<li>
									在 Nowbeam 设置的「接收端」里添加接收端，填入上面的地址与凭证。
								</li>
								<li>检查连接通过后启用这个接收端。</li>
								<li>在「分享与预览」确认内容，再恢复分享。</li>
							</ol>
						</div>
						<DialogFooter>
							<Button onClick={() => close(false)}>完成</Button>
						</DialogFooter>
					</>
				) : (
					<form onSubmit={submit}>
						<DialogHeader>
							<DialogTitle>签发设备凭证</DialogTitle>
							<DialogDescription>
								每台电脑一份凭证。凭证只能上报这台设备的状态，不能登录后台。
							</DialogDescription>
						</DialogHeader>
						<div className="my-5 space-y-1.5">
							<Label htmlFor="presence-device-name">设备名称</Label>
							<Input
								id="presence-device-name"
								value={name}
								maxLength={128}
								placeholder="例如 MacBook Pro"
								onChange={(event) => setName(event.target.value)}
								autoFocus
							/>
							<p className="text-xs text-muted-foreground">
								名称会随状态公开显示，不要填主机名或个人信息。
							</p>
						</div>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => close(false)}>
								取消
							</Button>
							<Button type="submit" disabled={!name.trim() || issue.isPending}>
								{issue.isPending ? "签发中…" : "签发"}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
