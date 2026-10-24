import { useCreatePAT, useUpdatePAT } from "@features/admin-mcp/api/queries";
import {
	type CreatePATRequest,
	MCP_SERVERS,
	PAT_SCOPES,
	type PATDTO,
	type PATScope,
	type UpdatePATRequest,
} from "@features/admin-mcp/model/types";
import { DateTimePicker } from "@shared/ui/date-time-picker/components/DateTimePicker";
import type { DateTimePreset } from "@shared/ui/date-time-picker/types/date-time-picker-types";
import { Button, Checkbox, Input, Label, Modal } from "@violet/ui";

import * as React from "react";
import { toast } from "sonner";

/** 创建与编辑共用的访问令牌表单。 */
export interface PATDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	token: PATDTO | null;
	/** 创建成功时包含一次性明文；编辑响应不进入此回调。 */
	onCreated: (token: PATDTO) => void;
	onUpdated: (token: PATDTO) => void;
}

/** 创建或编辑当前用户的访问令牌，共用字段与校验。 */
export function PATDialog({ open, onOpenChange, token, onCreated, onUpdated }: PATDialogProps) {
	const create = useCreatePAT();
	const update = useUpdatePAT();
	const [name, setName] = React.useState("");
	const [scopes, setScopes] = React.useState<Set<PATScope>>(new Set(["posts:read"]));
	const [expiresAt, setExpiresAt] = React.useState("");
	const [interactive, setInteractive] = React.useState(true);
	const submitting = React.useRef(false);
	const formId = React.useId();
	const pending = create.isPending || update.isPending;
	const initialExpiry = token ? (token.expires_at ? token.expires_at.slice(0, 10) : "never") : "";

	const { today, expiryPresets } = React.useMemo(() => {
		const fmt = (d: Date) => d.toISOString().slice(0, 10);
		const now = new Date();
		const addDays = (n: number) => {
			const x = new Date(now);
			x.setDate(x.getDate() + n);
			return fmt(x);
		};
		return {
			today: fmt(now),
			expiryPresets: [
				{ label: "90 天", value: addDays(90) },
				{ label: "365 天", value: addDays(365) },
				{ label: "永不过期", value: "never" },
			] as DateTimePreset[],
		};
	}, []);

	React.useEffect(() => {
		if (!open) return;
		setName(token?.name ?? "");
		setScopes(new Set(token?.scopes ?? ["posts:read"]));
		setExpiresAt(initialExpiry);
		setInteractive(token?.interactive ?? true);
	}, [open, token, initialExpiry]);

	const toggleScope = (s: PATScope) => {
		setScopes((prev) => {
			const next = new Set(prev);
			if (next.has(s)) {
				next.delete(s);
			} else {
				next.add(s);
			}
			return next;
		});
	};

	const changeOpen = (nextOpen: boolean) => {
		if (!submitting.current && !pending) onOpenChange(nextOpen);
	};

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (submitting.current || pending) return;
		const trimmedName = name.trim();
		if (!trimmedName) {
			toast.error("请填写令牌名称");
			return;
		}
		if ([...trimmedName].length > 100) {
			toast.error("令牌名称不能超过 100 个字符");
			return;
		}
		if (scopes.size === 0) {
			toast.error("至少选择一个权限");
			return;
		}
		if (token && !expiresAt) {
			toast.error("请选择有效期，或明确选择永不过期");
			return;
		}
		submitting.current = true;
		const body: CreatePATRequest = {
			name: trimmedName,
			scopes: [...scopes],
			expires_at: expiresAt,
			interactive,
		};
		try {
			if (token) {
				const { expires_at, ...fields } = body;
				const changes: UpdatePATRequest = fields;
				if (expiresAt !== initialExpiry) changes.expires_at = expires_at;
				onUpdated(await update.mutateAsync({ id: token.id, body: changes }));
			} else {
				onCreated(await create.mutateAsync(body));
			}
		} catch {
			// Mutation 已显示错误；保留字段，供用户修正或重试。
		} finally {
			submitting.current = false;
		}
	};

	return (
		<Modal
			open={open}
			onOpenChange={changeOpen}
			title={token ? "编辑访问令牌" : "创建访问令牌"}
			description={
				token ? "保存后原令牌和客户端配置仍可使用，无需重新签发或配置。" : undefined
			}
			footer={
				<>
					<Button variant="outline" onClick={() => changeOpen(false)} disabled={pending}>
						取消
					</Button>
					<Button type="submit" form={formId} loading={pending}>
						{token ? "保存" : "创建"}
					</Button>
				</>
			}
		>
			<form id={formId} onSubmit={submit} className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor={`${formId}-name`}>
						名称 <span className="text-destructive">*</span>
					</Label>
					<Input
						id={`${formId}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="如：Claude Desktop"
						disabled={pending}
						required
					/>
				</div>
				<fieldset className="space-y-2">
					<legend className="text-sm font-medium">
						权限范围 <span className="text-destructive">*</span>
					</legend>
					<div className="space-y-3">
						{MCP_SERVERS.filter((s) => !s.anonymous).map((server) => (
							<div key={server.key} className="space-y-1.5">
								<p className="text-sm">
									<span className="font-medium">{server.label}</span>
									<span className="text-muted-foreground">
										{" "}
										· {server.description}
									</span>
								</p>
								<div className="space-y-1.5 pl-1">
									{server.scopes
										.filter((s): s is PATScope =>
											(PAT_SCOPES as readonly string[]).includes(s),
										)
										.map((s) => (
											<div key={s} className="flex items-center gap-2">
												<Checkbox
													id={`${formId}-scope-${s}`}
													checked={scopes.has(s)}
													onCheckedChange={() => toggleScope(s)}
													disabled={pending}
												/>
												<Label
													htmlFor={`${formId}-scope-${s}`}
													className="cursor-pointer font-mono text-sm"
												>
													{s}
												</Label>
											</div>
										))}
								</div>
							</div>
						))}
					</div>
				</fieldset>
				<fieldset className="space-y-2">
					<legend className="text-sm font-medium">有效期</legend>
					<DateTimePicker
						value={expiresAt}
						onChange={setExpiresAt}
						mode="date"
						placeholder="默认 90 天"
						min={today}
						disabled={pending}
						clearable={false}
						presets={expiryPresets}
					/>
					<p className="text-xs text-muted-foreground">
						{token
							? "未修改时保留原过期时间；选择“永不过期”将移除到期限制。"
							: "默认 90 天，也可选择具体日期或永不过期。"}
					</p>
				</fieldset>
				<div className="flex items-start gap-2.5 rounded-lg border border-edge-hairline p-3">
					<Checkbox
						id={`${formId}-interactive`}
						checked={interactive}
						onCheckedChange={(v) => setInteractive(v === true)}
						disabled={pending}
						className="mt-0.5"
					/>
					<div className="space-y-1">
						<Label htmlFor={`${formId}-interactive`} className="cursor-pointer">
							agent 遇到冲突时询问我
						</Label>
						<p className="text-muted-foreground text-xs leading-relaxed">
							开启：操作冲突（如文章已挂其他书）时 agent 会给出候选方案让你选择。
							关闭：一路到底，可安全推荐的分叉按推荐项自动执行——适合无人值守的自动化脚本。
						</p>
					</div>
				</div>
			</form>
		</Modal>
	);
}
