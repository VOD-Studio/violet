import type { UserDTO } from "@entities/user/model/types";
import { GithubIcon } from "@shared/ui/icons/github";
import { CheckCircle2, KeyRound, Link2Off, Mail } from "lucide-react";

interface ConnectionsSectionProps {
	user: UserDTO;
}

/**
 * ConnectionsSection - 登录方式卡片
 *
 * 展示可用的登录途径与绑定状态（密码 / Google / GitHub）。
 * 绑定/解绑 OAuth 本轮不提供操作入口，仅展示状态。
 */
export const ConnectionsSection = ({ user }: ConnectionsSectionProps) => {
	return (
		<div className="rounded-xl border bg-card p-6 shadow-sm">
			<h2 className="mb-5 text-base font-semibold">登录方式</h2>
			<dl className="divide-y">
				<Row
					icon={<KeyRound className="size-4" />}
					label="邮箱密码"
					bound={user.has_password}
					boundText="已设置"
					unboundText="未设置"
				/>
				<Row
					icon={<Mail className="size-4" />}
					label="Google"
					bound={user.google_bound}
					boundText="已绑定"
					unboundText="未绑定"
				/>
				<Row
					icon={<GithubIcon className="size-4" />}
					label="GitHub"
					bound={user.github_bound}
					boundText="已绑定"
					unboundText="未绑定"
				/>
			</dl>
		</div>
	);
};

const Row = ({
	icon,
	label,
	bound,
	boundText,
	unboundText,
}: {
	icon: React.ReactNode;
	label: string;
	bound: boolean;
	boundText: string;
	unboundText: string;
}) => {
	return (
		<div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
			<dt className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
				{icon}
				{label}
			</dt>
			<dd className="flex items-center gap-1.5 text-sm">
				{bound ? (
					<>
						<CheckCircle2 className="size-3.5 text-emerald-500" />
						<span>{boundText}</span>
					</>
				) : (
					<>
						<Link2Off className="size-3.5 text-muted-foreground/60" />
						<span className="text-muted-foreground">{unboundText}</span>
					</>
				)}
			</dd>
		</div>
	);
};
