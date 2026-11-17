import { useGitHubRepo } from "@entities/github/api/queries";
import { LinkPreviews } from "@entities/link-preview/ui/LinkPreviews";
import { useExternalTweet } from "@entities/tweet/api/external";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { GitHubProjectReference } from "@shared/ui/article-embeds/GitHubProjectReference";
import type { ReactNode } from "react";
import type { ChatLink } from "../lib/chat-links";
import { ChatLinkContextMenu } from "./ChatLinkContextMenu";

function PreviewState({ pending }: { pending: boolean }) {
	return (
		<p role="status" className="py-1 text-xs text-muted-foreground">
			{pending ? "正在读取链接预览…" : "暂时无法读取预览，可打开原链接查看。"}
		</p>
	);
}

function GitHubLinkCard({ link }: { link: Extract<ChatLink, { kind: "github" }> }) {
	const query = useGitHubRepo(link.repo);
	if (!query.data) return <PreviewState pending={query.isPending} />;
	return (
		<GitHubProjectReference
			config={{
				repo: link.repo,
				href: link.href,
				description: query.data.description,
				language: query.data.language,
				stars: query.data.stars,
				forks: query.data.forks,
			}}
		/>
	);
}

function TweetLinkCard({ sourceID }: { sourceID: string }) {
	const query = useExternalTweet(sourceID);
	if (!query.data) return <PreviewState pending={query.isPending} />;
	return <ExternalTweetCard tweet={query.data} />;
}

/** 已有实体卡片的聊天编排；原文链接始终由 Markdown 保留。 */
export function ChatLinkCards({ links }: { links: ChatLink[] }) {
	if (!links.length) return null;
	return (
		<div className="my-2 min-w-0 space-y-2" data-chat-rich-content>
			{links.map((link) => {
				let card: ReactNode;
				if (link.kind === "github") {
					card = <GitHubLinkCard link={link} />;
				} else if (link.kind === "tweet") {
					card = <TweetLinkCard sourceID={link.sourceID} />;
				} else {
					card = <LinkPreviews urls={[link.href]} />;
				}
				return (
					<ChatLinkContextMenu key={link.key} href={link.href}>
						<div data-chat-link-url={link.href}>{card}</div>
					</ChatLinkContextMenu>
				);
			})}
		</div>
	);
}
