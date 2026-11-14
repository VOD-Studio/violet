import { EmbeddedTweet, type TweetData, type TweetMedia } from "@violetjs/react-tweet";
import { SCENE, type Scene, sceneUrl } from "./gallery-art";

const author = {
	name: "Mira Chen",
	handle: "sketchbook_demo",
	verification: "individual",
} as const;

function post(
	id: string,
	text: string,
	extra: { media?: TweetMedia[]; quotedTweet?: TweetData } = {},
): TweetData {
	return {
		url: `https://x.com/sketchbook_demo/status/${id}`,
		availability: "available",
		snapshot: { author, text, publishedAt: "2026-10-02T08:15:00.000Z", media: extra.media },
		quotedTweet: extra.quotedTweet,
	};
}

const photo = (scene: Scene): TweetMedia => ({
	kind: "photo",
	url: sceneUrl(scene),
	...SCENE,
	alt: `${scene} scene`,
});

// One picture cut into 20 narrow slices; portrait-heavy groups become a horizontal rail.
const slices: TweetMedia[] = Array.from({ length: 20 }, (_, index) => ({
	kind: "photo",
	url: sceneUrl("dusk", index * 72, 72),
	width: 72,
	height: SCENE.height,
	alt: `Slice ${index + 1} of 20`,
}));

const trip = post("1834000000000000003", "Studio trip, day two.", { media: [photo("meadow")] });

export function Gallery({ locale = "en-US" }: { locale?: string }) {
	const column = {
		display: "flex",
		flexDirection: "column",
		gap: 20,
		flex: 1,
		minWidth: 0,
	} as const;
	return (
		<div
			style={{ display: "flex", gap: 20, padding: 20, width: 1000, background: "whitesmoke" }}
		>
			<div style={column}>
				<EmbeddedTweet
					locale={locale}
					tweet={post("1834000000000000004", "Four pages from the new zine.", {
						media: [photo("dusk"), photo("lagoon"), photo("meadow"), photo("ink")],
					})}
				/>
				<EmbeddedTweet
					locale={locale}
					tweet={post("1834000000000000005", "Reposting the studio trip with a note.", {
						quotedTweet: trip,
					})}
				/>
				<EmbeddedTweet
					locale={locale}
					tweet={{
						url: "https://x.com/i/web/status/1834000000000000006",
						availability: "deleted",
					}}
				/>
				<EmbeddedTweet
					locale={locale}
					tweet={{
						url: "https://x.com/i/web/status/1834000000000000009",
						availability: "private",
					}}
				/>
			</div>
			<div style={column}>
				<EmbeddedTweet
					locale={locale}
					data-theme="dark"
					tweet={post("1834000000000000007", "One picture, cut into 20 slices.", {
						media: slices,
					})}
				/>
				<EmbeddedTweet
					locale={locale}
					tweet={post("1834000000000000008", "Process video, poster only.", {
						media: [{ kind: "video", thumbnailUrl: sceneUrl("lagoon"), ...SCENE }],
					})}
				/>
				<EmbeddedTweet locale={locale} quoted tweet={trip} />
			</div>
		</div>
	);
}
