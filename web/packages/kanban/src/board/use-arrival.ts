import { useEffect, useState } from "react";

/** 强调刚跳转到的卡片多久（毫秒）：够目光找到它，又不会一直亮着。 */
const ARRIVAL_MS = 1800;

/** 刚被跳转到的卡片：`arrive` 记下它，一小段时间后自动取消。 */
export function useArrival() {
	const [arrivedId, setArrivedId] = useState<string | null>(null);
	useEffect(() => {
		if (arrivedId === null) return;
		const timer = setTimeout(() => setArrivedId(null), ARRIVAL_MS);
		return () => clearTimeout(timer);
	}, [arrivedId]);
	return { arrivedId, arrive: setArrivedId };
}
