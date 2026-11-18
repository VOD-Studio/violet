import { useSharedTweet } from "@entities/tweet/api/queries";
import { useShareTweetStore } from "@entities/tweet/model/share-dialog-store";
import { authKeys } from "@features/auth/api/keys";
import { useMe } from "@features/auth/api/queries";
import { useSessionStore } from "@shared/api/session";
import { SITE_URL } from "@shared/config/env";
import { copyText } from "@shared/lib/clipboard";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Avatar, Button, Input, Modal } from "@violet/ui";
import { Check, ExternalLink, Hash, ImageDown, Link2, Search } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	createChatConversation,
	fetchChatContacts,
	fetchChatConversations,
	sendChatMessage,
} from "../api/client";
import { chatKeys } from "../api/keys";
import { conversationLabel, conversationTargetUser } from "../lib/conversation";
import { downloadTweetImage } from "../lib/export-tweet-image";
import type { ChatUser } from "../model/types";
import { TweetSharingPreview } from "./TweetSharingPreview";

type ShareTarget = {
	key: string;
	label: string;
	user: ChatUser;
	room?: boolean;
	conversationId?: string;
};

type ShareDelivery = { target: ShareTarget; idempotencyKey: string };

function externalStatusURL(value: string | undefined) {
	if (!value) return;
	try {
		const url = new URL(value);
		if (
			url.protocol === "https:" &&
			["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.host) &&
			/^\/(?:\w+|i\/web)\/status\/\d+\/?$/.test(url.pathname)
		) {
			return url.href;
		}
	} catch {
		return undefined;
	}
}

/** 分享推文：公开出口与已登录用户的聊天选择在同一个面板内。 */
export function ShareTweetDialog() {
	const tweetId = useShareTweetStore((state) => state.tweetId);
	const close = useShareTweetStore((state) => state.close);
	const identity = useMe({ enabled: tweetId !== null });
	const sessionActive = useSessionStore((state) => state.sessionActive);
	if (!tweetId) return null;
	const userId = identity.isSuccess ? identity.data?.id : undefined;
	return (
		<ShareSession
			key={`${tweetId}:${userId ?? "public"}`}
			tweetId={tweetId}
			userId={userId}
			checkingIdentity={sessionActive && identity.isPending}
			close={close}
		/>
	);
}

function ShareSession({
	tweetId,
	userId,
	checkingIdentity,
	close,
}: {
	tweetId: string;
	userId?: string;
	checkingIdentity: boolean;
	close: () => void;
}) {
	const queryClient = useQueryClient();
	const returnTo = useLocation({ select: (location) => location.href });
	const source = useSharedTweet(tweetId, true);
	const tweet = source.isSuccess && !source.isFetching ? source.data : undefined;
	const external = tweet?.external_tweet ?? tweet?.quoted_tweet?.external_tweet;
	const externalURL =
		external?.availability === "available" && external.snapshot
			? externalStatusURL(external.canonical_url)
			: undefined;
	const canonicalURL = `${SITE_URL.replace(/\/+$/, "")}/tweets/${encodeURIComponent(tweetId)}`;
	const [search, setSearch] = useState("");
	const [note, setNote] = useState("");
	const [selected, setSelected] = useState<ShareTarget[]>([]);
	const [failed, setFailed] = useState<ShareDelivery[]>([]);
	const [sentCount, setSentCount] = useState(0);
	const [sending, setSending] = useState(false);
	const sendingRef = useRef(false);
	const [exporting, setExporting] = useState(false);
	const query = useDeferredValue(search.trim());
	const needle = query.toLocaleLowerCase();
	const selectionLocked = sending || failed.length > 0;
	const conversations = useInfiniteQuery({
		queryKey: [...chatKeys.conversations(), "share", userId],
		queryFn: ({ pageParam, signal }) =>
			fetchChatConversations(pageParam || undefined, 20, signal),
		initialPageParam: "",
		getNextPageParam: (page) => page.pagination.next_cursor ?? undefined,
		enabled: Boolean(userId && tweet),
		meta: { sessionScoped: true },
	});
	const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = conversations;
	useEffect(() => {
		// 现有 API 只分页、不按名称筛选；搜索必须查完后续页才能断言无结果。
		if (userId && tweet && query && hasNextPage && !isFetching && !isFetchNextPageError) {
			void fetchNextPage();
		}
	}, [userId, tweet, query, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);
	const contacts = useInfiniteQuery({
		queryKey: [...chatKeys.contacts(query), "share", userId],
		queryFn: ({ pageParam, signal }) => fetchChatContacts(query, pageParam, 50, signal),
		initialPageParam: "",
		getNextPageParam: (page) => page.pagination.next_cursor ?? undefined,
		enabled: Boolean(userId && tweet && query && conversations.isSuccess && !hasNextPage),
		meta: { sessionScoped: true },
	});
	const visible = new Map<string, ShareTarget>();
	const directConversations = new Map<string, string>();
	for (const page of conversations.data?.pages ?? []) {
		for (const conversation of page.data) {
			const user = conversationTargetUser(conversation, userId);
			const label = conversationLabel(conversation, userId) || user.username;
			const room = conversation.kind !== "direct";
			const key = room ? conversation.id : `direct:${user.id}`;
			if (!room) directConversations.set(key, conversation.id);
			if (
				!needle ||
				label.toLocaleLowerCase().includes(needle) ||
				(!room && user.username.toLocaleLowerCase().includes(needle))
			) {
				visible.set(key, { key, conversationId: conversation.id, label, room, user });
			}
		}
	}
	if (query && !hasNextPage) {
		for (const page of contacts.data?.pages ?? []) {
			for (const user of page.data) {
				const key = `direct:${user.id}`;
				if (directConversations.has(key) || user.id === userId) continue;
				visible.set(key, { key, label: user.display_name || user.username, user });
			}
		}
	}
	// 搜索只过滤候选，不会把已选目标从选择栏挤掉。重试时只呈现失败对象。
	const options = failed.length
		? failed.map(({ target }) => target)
		: [...selected.filter(({ key }) => !visible.has(key)), ...visible.values()];

	function toggle(target: ShareTarget) {
		setSelected((previous) =>
			previous.some(({ key }) => key === target.key)
				? previous.filter(({ key }) => key !== target.key)
				: [...previous, target],
		);
	}

	async function send() {
		if (!userId || !tweet || sendingRef.current || !selected.length) return;
		const deliveries = failed.length
			? failed
			: selected.map((target) => ({
					target,
					idempotencyKey: crypto.randomUUID(),
				}));
		sendingRef.current = true;
		setSending(true);
		const content = note.trim();
		const results = await Promise.allSettled(
			deliveries.map(async (delivery) => {
				let id =
					delivery.target.conversationId ?? directConversations.get(delivery.target.key);
				if (!id) {
					const conversation = await createChatConversation({
						kind: "direct",
						participant_ids: [delivery.target.user.id],
					});
					id = conversation.id;
				}
				// 创建成功后记住 ID；即使发消息响应丢失，也只对原会话重发。
				delivery.target = { ...delivery.target, conversationId: id };
				if (queryClient.getQueryData<{ id: string } | null>(authKeys.me())?.id !== userId) {
					throw new Error("Chat session changed");
				}
				await sendChatMessage(
					id,
					{ type: "tweet_share", content, shared_tweet_id: tweet.id },
					delivery.idempotencyKey,
				);
				void queryClient.invalidateQueries({ queryKey: chatKeys.messages(id) });
			}),
		);
		if (queryClient.getQueryData<{ id: string } | null>(authKeys.me())?.id !== userId) return;
		void queryClient.invalidateQueries({ queryKey: chatKeys.conversations(), exact: true });
		const remaining = deliveries.filter((_, index) => results[index].status === "rejected");
		const totalSent = sentCount + deliveries.length - remaining.length;
		sendingRef.current = false;
		setSending(false);
		if (!remaining.length) {
			toast.success(`已发到 ${totalSent} 个会话`);
			if (useShareTweetStore.getState().tweetId === tweetId) close();
			return;
		}
		setSentCount(totalSent);
		setFailed(remaining);
		setSelected(remaining.map(({ target }) => target));
	}

	async function saveImage() {
		if (!tweet || exporting) return;
		setExporting(true);
		try {
			await downloadTweetImage(tweet, canonicalURL);
		} catch {
			toast.error("未能保存图片，请稍后重试");
		} finally {
			setExporting(false);
		}
	}

	return (
		<Modal
			open
			title="分享"
			size="sm"
			onOpenChange={(open) => {
				if (!open && !sendingRef.current) close();
			}}
		>
			<div className="space-y-4">
				<TweetSharingPreview query={source} />
				{tweet && (
					<>
						<section aria-label="发到聊天" className="space-y-3">
							<h3 className="text-sm font-medium">发到聊天</h3>
							{userId ? (
								<>
									<Input
										aria-label="搜索会话或用户"
										type="search"
										leading={<Search />}
										placeholder="搜索会话或用户"
										value={search}
										disabled={selectionLocked}
										onChange={(event) => setSearch(event.target.value)}
									/>
									<div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-5">
										{options.map((target) => {
											const picked = selected.some(
												({ key }) => key === target.key,
											);
											return (
												<Button
													key={target.key}
													aria-label={target.label}
													aria-pressed={picked}
													title={target.label}
													disabled={selectionLocked}
													variant={picked ? "secondary" : "ghost"}
													className="h-auto min-w-0 px-1 py-2"
													onClick={() => toggle(target)}
												>
													<span className="flex min-w-0 flex-col items-center gap-1">
														<span className="relative">
															<Avatar
																size={40}
																shape={
																	target.room
																		? "square"
																		: "circle"
																}
																name={target.label}
																alt=""
																src={
																	target.room
																		? undefined
																		: target.user.avatar_url
																}
																icon={
																	target.room ? (
																		<Hash />
																	) : undefined
																}
															/>
															{picked && (
																<span className="absolute right-0 bottom-0 rounded-full bg-primary p-0.5 text-primary-foreground">
																	<Check
																		className="size-3"
																		aria-hidden="true"
																	/>
																</span>
															)}
														</span>
														<span className="max-w-full truncate text-xs">
															{target.label}
														</span>
													</span>
												</Button>
											);
										})}
									</div>
									{!failed.length && (
										<>
											{(isFetching || (query && contacts.isFetching)) && (
												<p
													role="status"
													className="text-sm text-muted-foreground"
												>
													正在读取会话…
												</p>
											)}
											{!isFetching &&
												(conversations.isError || hasNextPage) && (
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															void (hasNextPage
																? fetchNextPage()
																: conversations.refetch())
														}
													>
														{conversations.isError
															? "重试读取会话"
															: "加载更多会话"}
													</Button>
												)}
											{!contacts.isFetching &&
												(contacts.isError || contacts.hasNextPage) &&
												query && (
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															void (contacts.hasNextPage
																? contacts.fetchNextPage()
																: contacts.refetch())
														}
													>
														{contacts.isError
															? "重试读取用户"
															: "加载更多用户"}
													</Button>
												)}
											{!options.length &&
												conversations.isSuccess &&
												!hasNextPage &&
												(!query || contacts.isSuccess) && (
													<p className="text-sm text-muted-foreground">
														{query
															? "没有匹配的会话或用户"
															: "暂无会话，可搜索用户开始私聊"}
													</p>
												)}
										</>
									)}
									{failed.length > 0 && (
										<p role="alert" className="text-sm text-muted-foreground">
											已发送 {sentCount} 个会话，{failed.length}{" "}
											个会话未确认收到。 重试只会发送给未确认的会话。
										</p>
									)}
									{selected.length > 0 && (
										<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
											<Input
												aria-label="附一句话（选填）"
												placeholder="附一句话（选填）"
												value={note}
												maxLength={10_000}
												readOnly={selectionLocked}
												onChange={(event) => setNote(event.target.value)}
											/>
											<Button
												variant="primary"
												loading={sending}
												loadingText="发送中…"
												onClick={() => void send()}
											>
												{failed.length
													? `重试 ${failed.length} 个会话`
													: `发送给 ${selected.length} 个会话`}
											</Button>
										</div>
									)}
								</>
							) : checkingIdentity ? (
								<p role="status" className="text-sm text-muted-foreground">
									正在确认登录状态…
								</p>
							) : (
								<Button asChild size="sm" variant="secondary">
									<Link
										to="/login"
										search={{ redirect: returnTo }}
										onClick={close}
									>
										登录后发到聊天
									</Link>
								</Button>
							)}
						</section>
						<div className="flex flex-wrap gap-2 border-t border-border pt-4">
							<Button
								variant="secondary"
								onClick={async () => {
									if (await copyText(canonicalURL)) {
										toast.success("链接已复制");
									} else {
										toast.error("未能复制链接");
									}
								}}
							>
								<Link2 />
								复制链接
							</Button>
							<Button
								variant="secondary"
								loading={exporting}
								loadingText="正在生成图片…"
								onClick={() => void saveImage()}
							>
								<ImageDown />
								存为图片
							</Button>
							{externalURL && (
								<Button asChild variant="secondary">
									<a href={externalURL} target="_blank" rel="noreferrer">
										<ExternalLink />在 X 打开
									</a>
								</Button>
							)}
						</div>
					</>
				)}
			</div>
		</Modal>
	);
}
