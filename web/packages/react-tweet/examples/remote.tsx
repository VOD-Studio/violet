import { Tweet, type TweetFetcher } from "@violetjs/react-tweet";

export function RemoteTweet({ fetcher }: { fetcher: TweetFetcher }) {
	return <Tweet id="1834000000000000002" fetcher={fetcher} />;
}
