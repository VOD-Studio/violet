import { Button, Input, type InputProps } from "@violet/ui";
import { Mail } from "lucide-react";
import { useState } from "react";

const variants = [
	"outline",
	"soft",
	"ghost",
	"underline",
] as const satisfies readonly InputProps["variant"][];

/** 四种外观共享输入、错误与复合焦点语义。 */
export function InputVariantsDemo() {
	const [invalid, setInvalid] = useState(false);

	return (
		<div className="w-full space-y-6">
			<Button variant="outline" aria-pressed={invalid} onClick={() => setInvalid(!invalid)}>
				{invalid ? "恢复正常状态" : "切换错误状态"}
			</Button>
			<div className="grid gap-6 sm:grid-cols-2">
				{variants.map((variant) => (
					<Input
						key={variant}
						variant={variant}
						label={`${variant} 邮箱`}
						type="email"
						defaultValue="reader@example.com"
						leading={<Mail aria-hidden="true" />}
						clearable
						invalid={invalid}
						errorMessage="请检查邮箱地址"
					/>
				))}
			</div>
		</div>
	);
}
