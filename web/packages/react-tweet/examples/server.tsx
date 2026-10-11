import { getTweet } from "@violetjs/react-tweet/api";
import { EmbeddedTweet } from "@violetjs/react-tweet/unstyled";
import { renderToStaticMarkup } from "react-dom/server";

export async function renderPost(id: string, signal?: AbortSignal) {
	const tweet = await getTweet(id, { signal });
	return renderToStaticMarkup(<EmbeddedTweet tweet={tweet} locale="en-US" timeZone="UTC" />);
}
