import { Link } from "@tanstack/react-router";
import { Button } from "@violet/ui";
import { ArrowRight } from "lucide-react";

/** 按钮作为导航链接：asChild 复用外观，不改变链接语义。 */
export function ButtonLinkDemo() {
	return (
		<div className="flex justify-center">
			<Button asChild variant="outline">
				<Link to="/design-system/decisions">
					查看快速决策表 <ArrowRight aria-hidden="true" />
				</Link>
			</Button>
		</div>
	);
}
