import { EmbeddedTweet, type TweetData } from "@violetjs/react-tweet";

export const saved: TweetData = {
	url: "https://x.com/sketchbook_demo/status/1834000000000000002",
	availability: "available",
	snapshot: {
		author: { name: "Mira Chen", handle: "sketchbook_demo", verification: "individual" },
		text: "Finished our sketchbook zine. Every page starts with a little ink.",
		publishedAt: "2026-09-14T09:30:00.000Z",
		metrics: { likes: 1284, replies: 46, reposts: 212 },
	},
};

export function Snapshot() {
	return <EmbeddedTweet tweet={saved} />;
}
