import { Input, type InputProps } from "@violet/ui";
import { UserRound } from "lucide-react";

const variants = [
	"outline",
	"soft",
	"ghost",
	"underline",
] as const satisfies readonly InputProps["variant"][];

/** 只读值可选择复制；禁用控件不参与表单提交。 */
export function InputStatesDemo() {
	return (
		<div className="grid w-full gap-6 sm:grid-cols-2">
			{variants.map((variant) => (
				<div key={variant} className="space-y-4">
					<Input
						variant={variant}
						label={`${variant} 只读账户`}
						defaultValue="violet-reader"
						leading={<UserRound aria-hidden="true" />}
						readOnly
						clearable
					/>
					<Input
						variant={variant}
						label={`${variant} 禁用账户`}
						defaultValue="violet-editor"
						leading={<UserRound aria-hidden="true" />}
						disabled
						clearable
					/>
				</div>
			))}
		</div>
	);
}
