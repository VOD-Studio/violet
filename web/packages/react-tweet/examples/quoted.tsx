import { EmbeddedTweet } from "@violetjs/react-tweet";
import { saved } from "./snapshot";

export function QuotedPost() {
	return <EmbeddedTweet tweet={saved} quoted />;
}
