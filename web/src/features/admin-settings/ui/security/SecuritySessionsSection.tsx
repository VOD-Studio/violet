import { useRevokeSession, useSessions } from "@features/auth/api/sessions";
import { Button } from "@shared/ui/base/button";
import { Skeleton } from "@shared/ui/base/skeleton";
import { InlineError } from "@shared/ui/inline-error";

/** 待吊销会话（点「吊销」后由确认弹窗消费）。 */
export interface RevokeTarget {
	publicId: string;
	current: boolean;
}

interface SecuritySessionsSectionProps {
	onRevoke: (target: RevokeTarget) => void;
}

/** 设备/会话管理区块：当前用户全部登录会话与吊销入口。 */
export function SecuritySessionsSection({ onRevoke }: SecuritySessionsSectionProps) {
	const sessions = useSessions();
	const revokeMut = useRevokeSession();

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-semibold">登录设备</h3>
				{revokeMut.isPending && (
					<span className="text-xs text-muted-foreground">吊销中…</span>
				)}
			</div>
			{sessions.isLoading ? (
				<Skeleton className="h-16 w-full" />
			) : sessions.isError ? (
				<InlineError
					message={
						sessions.error instanceof Error
							? sessions.error.message
							: "加载登录会话失败"
					}
					onRetry={() => sessions.refetch()}
				/>
			) : (
				<ul className="divide-y divide-edge-hairline rounded-lg border border-edge-hairline">
					{(sessions.data ?? []).map((device) => (
						<li
							key={device.public_id}
							className="flex flex-wrap items-center justify-between gap-3 p-4"
						>
							<div className="min-w-0 flex-1 space-y-1">
								<div className="flex flex-wrap items-center gap-2 text-sm font-medium">
									<span>{describeUserAgent(device.user_agent)}</span>
									{device.current && (
										<span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
											当前设备
										</span>
									)}
								</div>
								<p className="text-xs text-muted-foreground">
									IP {device.client_ip || "未知"} · 登录于{" "}
									{new Date(device.created_at).toLocaleString()} · 最近活跃{" "}
									{new Date(device.last_seen_at).toLocaleString()}
								</p>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									onRevoke({
										publicId: device.public_id,
										current: device.current,
									})
								}
							>
								吊销
							</Button>
						</li>
					))}
					{(sessions.data ?? []).length === 0 && (
						<li className="p-4 text-sm text-muted-foreground">暂无活跃登录会话</li>
					)}
				</ul>
			)}
		</section>
	);
}

const UA_OS_PATTERNS: readonly (readonly [RegExp, string])[] = [
	[/Windows/i, "Windows"],
	[/Mac OS X|Macintosh/i, "macOS"],
	[/Android/i, "Android"],
	[/iPhone|iPad/i, "iOS"],
	[/Linux/i, "Linux"],
];

const UA_BROWSER_PATTERNS: readonly (readonly [RegExp, string])[] = [
	[/Edg\//i, "Edge"],
	[/Chrome\//i, "Chrome"],
	[/Firefox\//i, "Firefox"],
	[/Safari\//i, "Safari"],
];

/** 从 User-Agent 提取浏览器/系统简称（展示用，不做精确解析）。 */
function describeUserAgent(ua: string): string {
	if (!ua) return "未知设备";
	const os = UA_OS_PATTERNS.find(([pattern]) => pattern.test(ua))?.[1] ?? "未知系统";
	const browser = UA_BROWSER_PATTERNS.find(([pattern]) => pattern.test(ua))?.[1] ?? "未知浏览器";
	return `${browser} · ${os}`;
}
