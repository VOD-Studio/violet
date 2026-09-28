import { Button } from "@violet/ui";
import { useState } from "react";

/** 按钮基础用法：受控点击计数。 */
export function ButtonBasicDemo() {
	const [clicks, setClicks] = useState(0);
	return (
		<div className="flex justify-center">
			<Button type="button" onClick={() => setClicks((count) => count + 1)}>
				已点击 {clicks} 次
			</Button>
		</div>
	);
}
