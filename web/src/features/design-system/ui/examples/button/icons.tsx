import { Button } from "@violet/ui";
import { ArrowRight, Download, Mail, Sparkles } from "lucide-react";

/** 按钮 leftIcon 与 rightIcon 图标插槽。 */
export function ButtonIconsDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Button leftIcon={<Mail aria-hidden="true" />}>发送邮件</Button>
			<Button rightIcon={<ArrowRight aria-hidden="true" />} variant="brand">
				继续阅读
			</Button>
			<Button leftIcon={<Sparkles aria-hidden="true" />} variant="soft">
				灵感启发
			</Button>
			<Button
				leftIcon={<Download aria-hidden="true" />}
				rightIcon={<ArrowRight aria-hidden="true" />}
				variant="outline"
			>
				导出数据
			</Button>
		</div>
	);
}
