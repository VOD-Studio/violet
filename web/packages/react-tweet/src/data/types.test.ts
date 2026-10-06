import { expectTypeOf, it } from "vitest";

import type {
	AvailableTweet,
	TweetAffiliation,
	TweetAuthor,
	TweetData,
	TweetMedia,
	TweetSegment,
	TweetSnapshot,
	TweetVerification,
	UnavailableTweet,
} from "../unstyled.ts";

it("可用性决定快照的类型契约", () => {
	expectTypeOf<TweetData>()
		.extract<{ availability: "available" }>()
		.toEqualTypeOf<AvailableTweet>();
	expectTypeOf<AvailableTweet["snapshot"]>().toEqualTypeOf<TweetSnapshot>();
	expectTypeOf<UnavailableTweet["snapshot"]>().toEqualTypeOf<undefined>();
	expectTypeOf<UnavailableTweet["quotedTweet"]>().toEqualTypeOf<undefined>();
	expectTypeOf<{ url: string; availability: "available" }>().not.toExtend<TweetData>();
});

it("照片、视频与链接不能构造为空袋子", () => {
	expectTypeOf<{ kind: "photo" }>().not.toExtend<TweetMedia>();
	expectTypeOf<{ kind: "video" }>().not.toExtend<TweetMedia>();
	expectTypeOf<{ kind: "video"; thumbnailUrl: string }>().toExtend<TweetMedia>();
	expectTypeOf<{ kind: "video"; url: string }>().toExtend<TweetMedia>();
	expectTypeOf<{ kind: "link"; text: string }>().not.toExtend<TweetSegment>();
	expectTypeOf<{ kind: "text"; text: string; url: string }>().not.toExtend<TweetSegment>();
});

it("作者认证类别与组织关联独立且组织徽标不可缺省", () => {
	expectTypeOf<TweetAuthor["verification"]>().toEqualTypeOf<TweetVerification | undefined>();
	expectTypeOf<TweetVerification>().toEqualTypeOf<"individual" | "business" | "government">();
	expectTypeOf<TweetAuthor>().not.toHaveProperty("verified");
	expectTypeOf<{ name: string }>().not.toExtend<TweetAffiliation>();
	expectTypeOf<{ imageUrl: string }>().toExtend<TweetAffiliation>();
});
