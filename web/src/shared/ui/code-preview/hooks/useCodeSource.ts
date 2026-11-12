import { useCallback, useEffect, useState } from "react";

interface CodeSourceState {
	url: string;
	attempt: number;
	status: "loading" | "ready" | "error";
	source: string;
}

export function useCodeSource(url: string) {
	const [attempt, setAttempt] = useState(0);
	const [state, setState] = useState<CodeSourceState>({
		url,
		attempt,
		status: "loading",
		source: "",
	});
	const retry = useCallback(() => setAttempt((value) => value + 1), []);

	useEffect(() => {
		const controller = new AbortController();
		setState({ url, attempt, status: "loading", source: "" });
		void fetch(url, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const source = await response.text();
				if (!controller.signal.aborted) setState({ url, attempt, status: "ready", source });
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setState({ url, attempt, status: "error", source: "" });
			});
		return () => controller.abort();
	}, [url, attempt]);
	const current = state.url === url && state.attempt === attempt;

	return {
		source: current ? state.source : "",
		loadStatus: current ? state.status : "loading",
		retry,
	};
}
