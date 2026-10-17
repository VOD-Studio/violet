import { Input } from "@violet/ui";
import { useState } from "react";

export function InputBasicDemo() {
	const [name, setName] = useState("Violet");

	return (
		<div className="w-full max-w-sm space-y-5">
			<Input
				label="名称"
				name="name"
				value={name}
				onChange={(event) => setName(event.target.value)}
				clearable
			/>
			<Input aria-label="备注" placeholder="备注（选填）" classNames={{ root: "w-full" }} />
		</div>
	);
}
