import { Button, Separator } from "@violet/ui";
import type { Exhibit } from "../../model/exhibit";

function SeparatorSamples() {
	return (
		<div className="p-1">
			<div className="grid w-138 grid-cols-2 items-start gap-8 text-sm">
				<div className="flex flex-col gap-8">
					<div className="text-muted-foreground flex items-center text-[13px] whitespace-nowrap">
						<span>2026-11-02</span>
						<Separator variant="dot" />
						<span>6 分钟</span>
						<Separator variant="dot" />
						<span>技术</span>
					</div>
					<div className="flex w-65 flex-col gap-3">
						<Button className="w-full">用 GitHub 登录</Button>
						<Separator>或</Separator>
						<Button variant="ghost" className="w-full">
							用邮箱登录
						</Button>
					</div>
				</div>
				<div className="flex flex-col gap-0.5">
					<b className="font-semibold">账户</b>
					<span className="text-muted-foreground">邮箱、密码与两步验证</span>
					<Separator decorative={false} spacing="section" />
					<b className="font-semibold">通知</b>
					<span className="text-muted-foreground">站内信与邮件提醒</span>
				</div>
			</div>
		</div>
	);
}

export const separatorExhibit: Exhibit = {
	id: "separator",
	name: "分隔",
	units: ["separator"],
	zone: "content",
	category: "layout",
	footprint: { width: 560, height: 240 },
	Render: SeparatorSamples,
};
