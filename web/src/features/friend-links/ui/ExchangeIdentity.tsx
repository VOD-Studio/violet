import type { SiteSettings } from "@features/settings/model/types";
import { copyText } from "@shared/lib/clipboard";
import { Button, Card } from "@violet/ui";
import { Copy } from "lucide-react";
import { useState } from "react";

/** 只复制服务端公开设置；未配置的值不生成示例或猜测地址。 */
export function ExchangeIdentity({
	settings,
}: {
	settings: Pick<SiteSettings, "site_name" | "site_url" | "avatar_url" | "bio">;
}) {
	const [feedback, setFeedback] = useState("");
	let avatar = settings.avatar_url;
	try {
		avatar = avatar ? new URL(avatar, settings.site_url).href : "";
	} catch {
		avatar = "";
	}
	const fields = [
		["名称", settings.site_name],
		["地址", settings.site_url],
		["头像", avatar],
		["简介", settings.bio],
	];
	return (
		<>
			<Card className="mt-7">
				<dl className="divide-y divide-border">
					{fields.map(([label, value]) => (
						<div
							key={label}
							className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm"
						>
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="min-w-0 break-all">{value || "尚未配置"}</dd>
							<Button
								variant="ghost"
								iconOnly
								aria-label={`复制${label}`}
								disabled={!value}
								onClick={async (event) => {
									const button = event.currentTarget;
									const copied = await copyText(value);
									setFeedback(
										copied
											? `已复制${label}`
											: `复制${label}失败，请选中文字复制`,
									);
									if (document.activeElement === document.body) button.focus();
								}}
							>
								<Copy className="size-4" aria-hidden="true" />
							</Button>
						</div>
					))}
				</dl>
			</Card>
			<p role="status" className="mt-2 min-h-5 text-xs text-muted-foreground">
				{feedback}
			</p>
		</>
	);
}
