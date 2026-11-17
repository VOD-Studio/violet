import { useGitHubRepo } from "@entities/github/api/queries";
import { LinkPreviews } from "@entities/link-preview/ui/LinkPreviews";
import { useExternalTweet } from "@entities/tweet/api/external";
import { ExternalTweetCard } from "@entities/tweet/ui/ExternalTweetCard";
import { GitHubProjectReference } from "@shared/ui/article-embeds/GitHubProjectReference";
import { LinkCard } from "@violet/ui";
import type { ReactNode } from "react";
import type { ChatLink } from "../lib/chat-links";
import { ChatLinkContextMenu } from "./ChatLinkContextMenu";

function PreviewState({ link, pending }: { link: ChatLink; pending: boolean }) {
	return (
		<LinkCard
			href={link.href}
			title={pending ? new URL(link.href).hostname : "打开原链接"}
			description="暂时无法读取预览"
			loading={pending}
		/>
	);
}

function GitHubLinkCard({ link }: { link: Extract<ChatLink, { kind: "github" }> }) {
	const query = useGitHubRepo(link.repo);
	if (!query.data) return <PreviewState link={link} pending={query.isPending} />;
	return (
		<GitHubProjectReference
			compact
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

function TweetLinkCard({ link }: { link: Extract<ChatLink, { kind: "tweet" }> }) {
	const query = useExternalTweet(link.sourceID);
	if (!query.data) return <PreviewState link={link} pending={query.isPending} />;
	if (query.data.availability !== "available" || !query.data.snapshot) {
		return <PreviewState link={link} pending={false} />;
	}
	return <ExternalTweetCard tweet={query.data} compact />;
}

/** 三类链接共用加载与不可用形态，成功后保留各自已有卡片。 */
export function ChatLinkCards({ links }: { links: ChatLink[] }) {
	if (!links.length) return null;
	return (
		<div className="min-w-0 space-y-2 not-first:mt-2" data-chat-rich-content>
			{links.map((link) => {
				let card: ReactNode;
				if (link.kind === "github") {
					card = <GitHubLinkCard link={link} />;
				} else if (link.kind === "tweet") {
					card = <TweetLinkCard link={link} />;
				} else {
					card = <LinkPreviews urls={[link.href]} compact />;
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
