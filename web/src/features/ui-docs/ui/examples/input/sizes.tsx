import { Input, type InputProps } from "@violet/ui";
import { Search } from "lucide-react";

const sizes = ["sm", "md", "lg"] as const satisfies readonly InputProps["controlSize"][];

/** 控件尺寸与原生 size 属性独立。 */
export function InputSizesDemo() {
	return (
		<div className="w-full max-w-sm space-y-5">
			{sizes.map((controlSize) => (
				<Input
					key={controlSize}
					controlSize={controlSize}
					label={`${controlSize} 尺寸`}
					placeholder="搜索内容"
					leading={<Search aria-hidden="true" />}
					clearable
				/>
			))}
		</div>
	);
}
