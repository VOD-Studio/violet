import { useMe } from "@features/auth/api/queries";
import { ApiError } from "@shared/api/error";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { runtimeLogKeys } from "../api/keys";
import { MAX_RUNTIME_LOG_PAGES, useRuntimeLogs } from "../api/queries";
import type { RuntimeLogEntry, RuntimeLogFilter } from "../model/types";
import { useRuntimeLogStream } from "./useRuntimeLogStream";

const compareCursor = (left: RuntimeLogEntry, right: RuntimeLogEntry) => {
	const a = BigInt(left.id);
	const b = BigInt(right.id);
	return a < b ? -1 : a > b ? 1 : 0;
};

/** 维持历史快照、实时边界及阅读位置，不让筛选和暂停语义互相覆盖。 */
export function useRuntimeLogReader() {
	const me = useMe();
	const [filters, setFilters] = useState<RuntimeLogFilter>({});
	const [refreshing, setRefreshing] = useState(false);
	const [streamBoundary, setStreamBoundary] = useState<string | null>(null);
	const [followPaused, setFollowPaused] = useState(false);
	const [newWhilePaused, setNewWhilePaused] = useState(0);
	const scrollRef = useRef<HTMLDivElement>(null);
	const scrollAnchorRef = useRef<{ id: string; offset: number } | null>(null);
	const initialScrollRef = useRef(false);
	const previousLiveIDsRef = useRef(new Set<string>());
	const queryClient = useQueryClient();
	const query = useRuntimeLogs(filters);
	const pages = query.data?.pages ?? [];
	const firstPage = query.data?.pages[0];
	const historyWindowKey = pages
		.map((page) => `${page.items[0]?.id ?? ""}:${page.items.at(-1)?.id ?? ""}`)
		.join("|");
	const historyEntries = useMemo(
		() => (query.data?.pages ?? []).flatMap((page) => page.items).sort(compareCursor),
		[query.data?.pages],
	);
	const atLimit = pages.length >= MAX_RUNTIME_LOG_PAGES;
	const newerPagesEvicted = Boolean(query.data?.pageParams[0]);
	const historyGap = pages.some((page) => page.gap);
	const forbidden = query.error instanceof ApiError && query.error.status === 403;

	useEffect(() => {
		if (streamBoundary === null && firstPage && !refreshing) {
			setStreamBoundary(firstPage.newest_cursor);
		}
	}, [firstPage, refreshing, streamBoundary]);

	const stream = useRuntimeLogStream(
		filters,
		streamBoundary ?? "0",
		streamBoundary !== null && Boolean(query.data) && !refreshing,
	);
	const entries = useMemo(() => {
		const byID = new Map<string, RuntimeLogEntry>();
		for (const entry of historyEntries) byID.set(entry.id, entry);
		for (const entry of stream.entries) byID.set(entry.id, entry);
		return [...byID.values()].sort(compareCursor);
	}, [historyEntries, stream.entries]);

	useEffect(() => {
		if (stream.connection === "revoked") void me.refetch();
	}, [me.refetch, stream.connection]);

	useLayoutEffect(() => {
		const container = scrollRef.current;
		const anchor = scrollAnchorRef.current;
		if (!container || !anchor || !historyWindowKey || query.isFetchingNextPage) return;
		const row = container.querySelector<HTMLElement>(
			`[data-runtime-log-id="${CSS.escape(anchor.id)}"]`,
		);
		container.scrollTop = row
			? container.scrollTop +
				row.getBoundingClientRect().top -
				container.getBoundingClientRect().top -
				anchor.offset
			: 0;
		scrollAnchorRef.current = null;
	}, [historyWindowKey, query.isFetchingNextPage]);

	useLayoutEffect(() => {
		const currentIDs = new Set(stream.entries.map((entry) => entry.id));
		let added = 0;
		for (const id of currentIDs) {
			if (!previousLiveIDsRef.current.has(id)) added++;
		}
		previousLiveIDsRef.current = currentIDs;
		if (added === 0) return;
		if (followPaused) {
			setNewWhilePaused((current) => current + added);
			return;
		}
		const container = scrollRef.current;
		if (container) container.scrollTop = container.scrollHeight;
	}, [followPaused, stream.entries]);

	useLayoutEffect(() => {
		const container = scrollRef.current;
		if (
			!container ||
			initialScrollRef.current ||
			followPaused ||
			query.isPending ||
			entries.length === 0
		)
			return;
		container.scrollTop = container.scrollHeight;
		initialScrollRef.current = true;
	}, [entries.length, followPaused, query.isPending]);

	function handleLoadEarlier() {
		const container = scrollRef.current;
		if (container) {
			const top = container.getBoundingClientRect().top;
			const row = Array.from(
				container.querySelectorAll<HTMLElement>("[data-runtime-log-id]"),
			).find((element) => element.getBoundingClientRect().bottom > top);
			const id = row?.dataset.runtimeLogId;
			if (row && id)
				scrollAnchorRef.current = { id, offset: row.getBoundingClientRect().top - top };
		}
		void query.fetchNextPage();
	}

	function resetStream() {
		setStreamBoundary(null);
		setNewWhilePaused(0);
		previousLiveIDsRef.current = new Set();
		initialScrollRef.current = false;
	}

	function handleApply(next: RuntimeLogFilter) {
		scrollAnchorRef.current = null;
		resetStream();
		setFilters(next);
		void queryClient.resetQueries({ queryKey: runtimeLogKeys.list(next), exact: true });
		scrollRef.current?.scrollTo({ top: 0 });
	}

	async function handleRefresh() {
		scrollAnchorRef.current = null;
		setRefreshing(true);
		resetStream();
		try {
			const target = { queryKey: runtimeLogKeys.list(filters), exact: true };
			await queryClient.cancelQueries(target);
			await Promise.all([
				queryClient.resetQueries(target),
				queryClient.invalidateQueries({ queryKey: runtimeLogKeys.status(), exact: true }),
				queryClient.invalidateQueries({ queryKey: runtimeLogKeys.policy(), exact: true }),
			]);
		} finally {
			setRefreshing(false);
		}
	}

	function resumeFollow() {
		setFollowPaused(false);
		setNewWhilePaused(0);
		requestAnimationFrame(() => {
			const container = scrollRef.current;
			if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
		});
	}

	return {
		filters,
		refreshing,
		query,
		stream,
		entries,
		historyEntries,
		atLimit,
		newerPagesEvicted,
		historyGap,
		forbidden,
		followPaused,
		newWhilePaused,
		scrollRef,
		setFollowPaused,
		handleLoadEarlier,
		handleApply,
		handleRefresh,
		resumeFollow,
	};
}
