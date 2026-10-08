import { Segmented } from "@violet/ui";
import { useState } from "react";

const VARIANTS = ["soft", "ink", "line"] as const;
const SEGMENTS = [
	{ value: "overview", label: "概览" },
	{ value: "activity", label: "动态" },
	{ value: "settings", label: "设置" },
];

/** 横纵两个方向与三种变体的组合；ink 的轨道底色由使用方给出。 */
export function SegmentedOrientationDemo() {
	const [value, setValue] = useState("activity");

	return (
		<div className="grid w-full gap-8 sm:grid-cols-2">
			{(["horizontal", "vertical"] as const).map((orientation) => (
				<div key={orientation} className="space-y-4">
					<p className="font-mono text-xs text-muted-foreground">{orientation}</p>
					{VARIANTS.map((variant) => (
						<div key={variant} className="flex items-start gap-3">
							<span className="w-10 pt-2 font-mono text-xs text-muted-foreground">
								{variant}
							</span>
							<Segmented
								aria-label={`${orientation} ${variant}`}
								orientation={orientation}
								variant={variant}
								className={variant === "ink" ? "bg-muted" : undefined}
								value={value}
								onValueChange={setValue}
								segments={SEGMENTS}
							/>
						</div>
					))}
				</div>
			))}
		</div>
	);
}
