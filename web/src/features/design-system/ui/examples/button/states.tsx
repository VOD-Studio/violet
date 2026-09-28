import { Button } from "@violet/ui";
import { Mail } from "lucide-react";
import { useState } from "react";

/** 按钮加载与禁用状态；加载中自动禁用并设置 aria-busy。 */
export function ButtonStatesDemo() {
	const [simulating, setSimulating] = useState(false);

	const handleSimulateLoading = () => {
		setSimulating(true);
		window.setTimeout(() => setSimulating(false), 2000);
	};

	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Button
				type="button"
				variant="brand"
				loading={simulating}
				onClick={handleSimulateLoading}
			>
				保存修改
			</Button>
			<Button type="button" variant="default" loading loadingText="正在同步数据...">
				提交发布
			</Button>
			<Button type="button" variant="outline" loading leftIcon={<Mail aria-hidden="true" />}>
				发送邮件
			</Button>
			<Button type="button" disabled>
				已归档
			</Button>
		</div>
	);
}
