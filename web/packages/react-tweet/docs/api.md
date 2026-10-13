# API reference

[简体中文](./api.zh-CN.md) · [README](../README.md)

All component and data types below are exported by both `@violetjs/react-tweet` and `@violetjs/react-tweet/unstyled`. The former imports CSS; the latter does not. Only `getTweet`, `parseTweetId`, and `GetTweetOptions` are exported by `/api`. There is no CommonJS entry. `/styles.css` is the complete default stylesheet; `/package.json` exposes metadata.

## Components

### `EmbeddedTweet(props: EmbeddedTweetProps)`

Renders a saved `TweetData` value without fetching post data, scripts, or iframes. Media resources are still requested by the browser.

| Prop | Type | Default / meaning |
| --- | --- | --- |
| `tweet` | `TweetData` | Required; snapshot or explicit unavailable state. |
| `compact` | `boolean` | `false`; smaller padding. |
| `locale`, `timeZone`, `messages`, `maxTextLines` | `TweetDisplayOptions` | See display options below. |
| `renderPhotos`, `renderVideo`, `onOpenPhoto` | `TweetMediaRenderers` | See media extensions below. |
| Native article props | `Omit<ComponentPropsWithRef<"article">, "children" \| "dangerouslySetInnerHTML">` | Includes `id`, `ref`, `className`, `style`, ARIA, data attributes, and events. |

The root is an `article`. Body clicks bubble; native descendant links and media manage their own interaction without swallowing events from host portals. `aria-label` overrides the default localized label. `data-state` is `available`, `unavailable`, `deleted`, or `private`.

Unavailable states never show snapshot/quote content, even if malformed external data contains it. Quotes expand at most one level; deeper quotes retain a source link. The footer displays likes, replies, reposts, and publication time when provided. Like/reply links open actual X intent pages in a new tab; repost counts are read-only. No engagement is simulated locally.

### `Tweet(props: TweetProps)`

Client-side loading component. During server rendering it outputs a loading skeleton, not fetched content.

| Prop | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Required source ID or X/Twitter status URL; not a DOM `id`. |
| `fetcher` | `TweetFetcher` | Required host-owned loader. Keep its reference stable. |
| Display and media props | `TweetDisplayOptions & TweetMediaRenderers` | Same behavior as `EmbeddedTweet`. |
| Native article props | `Omit<ComponentPropsWithRef<"article">, "children" \| "dangerouslySetInnerHTML" \| "id">` | Passed to the loading/error article or loaded card. |

`Tweet` does **not** accept `compact`. On mount, ID/fetcher change, and manual retry it starts a request. Replacing a request or unmounting aborts its signal. Late results are ignored even if the fetcher ignores cancellation. Old content is hidden while a new request loads. Errors show a source link and retry button; known unavailable results are rendered without automatic retries. Loading/error roots use `data-state="loading"` / `"error"`, `aria-busy`, and a `role="status"` message. Skeleton animation respects reduced motion.

```ts
interface TweetFetcherOptions { signal: AbortSignal }
type TweetFetcher = (id: string, options: TweetFetcherOptions) => Promise<TweetData>;
```

Implement caching, authentication, response validation, and endpoint selection in your host. The package does not provide an HTTP endpoint or cache. Do not call `getTweet` directly in the browser.

### `TweetCard(props: TweetCardProps)`

Source-independent layout with no automatic X branding, source links, localization, or network requests.

| Prop | Type | Default / meaning |
| --- | --- | --- |
| `headerSlot` | `ReactNode` | Author/header content. |
| `contentSlot` | `ReactNode` | Body content. |
| `mediaSlot` | `ReactNode` | Media content. |
| `quoteSlot` | `ReactNode` | Quoted content, wrapped with quote spacing unless null/undefined/false. |
| `footerSlot` | `ReactNode` | Footer content. |
| `compact` | `boolean` | `false`; compact padding. |
| `isQuoted` | `boolean` | `false`; nested-card border, typography, and spacing. |
| Native article props | Same native props as `EmbeddedTweet` | Passed to the root. |

Slots render in the order listed. Every slot is optional. `isQuoted` marks an actual nested card, not a quote placeholder. The host owns slot semantics and interaction.

## Display options

`TweetDisplayOptions` is shared by `Tweet` and `EmbeddedTweet`:

| Field | Type | Default / behavior |
| --- | --- | --- |
| `maxTextLines` | `number?` | `6`; positive integer limits body lines. Zero, negative, fractional, or non-finite values disable collapsing. |
| `locale` | `string?` | `"en-US"`; date/number formatting and built-in message selection. |
| `timeZone` | `string?` | `"UTC"`; explicit date timezone. Invalid values fall back to UTC. |
| `messages` | `Partial<TweetMessages>?` | Override individual built-in strings. |

English and Simplified Chinese UI messages are built in. Other valid locales still format dates/numbers for that locale but use English messages unless overridden. Invalid locale tags safely fall back. Neither server local time nor browser language is consulted. For hydration use the same `locale`, `timeZone`, data, and message overrides on both sides.

Text collapse applies independently to outer and quoted bodies, never to media/actions. SSR retains full text and links with clamping styles; after mounting, measurement adds the expand button only when necessary. Resize and font changes trigger remeasurement. Original post text and `warnings` are never translated or parsed as HTML.

### `TweetMessages`

Every field is a `string`. Supply `Partial<TweetMessages>` for overrides or a complete dictionary for a new language. Placeholders are replaced with localized numbers, not interpreted as HTML.

| Key | Meaning / placeholders |
| --- | --- |
| `tweetLabel` | Default article accessible name. |
| `source` | Original-post link. |
| `loading` | Screen-reader loading status. |
| `error` | Retryable request error. |
| `retry` | Retry button. |
| `unavailable` | Unavailable for unknown reasons. |
| `deleted` | Source-confirmed deletion. |
| `private` | Source-confirmed private post. |
| `verified` | Individual verification badge label. |
| `verifiedBusiness` | Business verification badge label. |
| `verifiedGovernment` | Government verification badge label. |
| `affiliation` | Affiliation label when its name is absent. |
| `likeAction` | X like action label. |
| `replyAction` | X reply action label. |
| `showMore` | Expand body button. |
| `showLess` | Collapse body button. |
| `quote` | Quoted-post source link. |
| `photo` | Fallback photo alt; `{index}`. |
| `viewPhoto` | Original-photo link label; `{index}`. |
| `photoRail` | Horizontal photo rail label; `{count}`. |
| `previousPhotos` | Previous-photo button. |
| `nextPhotos` | Next-photo button. |
| `imageUnavailable` | Failed photo message. |
| `videoPoster` | Fallback video poster alt. |
| `videoPosterUnavailable` | Failed video poster message. |
| `video` | Native video player label. |
| `animation` | Native animation player label. |
| `viewVideo` | Video source link / playback fallback. |
| `playVideo` | Video play button label, followed by the video name. |
| `replies` | Reply metric label; `{count}`. |
| `reposts` | Repost metric label; `{count}`. |
| `likes` | Like metric label; `{count}`. |
| `poll` | Poll available at source. |
| `article` | X article available at source. |
| `incompleteText` | Possibly truncated text. |
| `unsupportedMedia` | Unsupported media warning. |
| `unavailableMedia` | Missing or filtered media warning. |

## Data model

`?` means optional; `| null` is accepted only where explicitly shown. All interfaces are publicly exported.

### `TweetData`, `AvailableTweet`, `UnavailableTweet`, `TweetAvailability`

```ts
type TweetAvailability = "available" | "unavailable" | "deleted" | "private";
type TweetData = AvailableTweet | UnavailableTweet;
interface AvailableTweet {
  id?: string;
  url: string;
  availability: "available";
  snapshot: TweetSnapshot;
  quotedTweet?: TweetData | null;
}
interface UnavailableTweet {
  id?: string;
  url: string;
  availability: "unavailable" | "deleted" | "private";
  snapshot?: never;
  quotedTweet?: never;
}
```

An empty body can represent a media-only available post. Do not use a missing snapshot as a loading state. `id` is a positive decimal X ID; `url` is the original link. General display URLs accept HTTP(S) and same-origin root-relative paths. Unsafe schemes, protocol-relative paths, credentials, whitespace/control characters, and backslashes are rejected; source links may fall back to a valid ID.

### `TweetSnapshot`

| Field | Type | Meaning |
| --- | --- | --- |
| `author` | `TweetAuthor` | Required author identity. |
| `text` | `string` | Required complete plain text (can be empty). |
| `segments` | `TweetSegment[] \| null` (optional) | Ordered rich segments; used for display when present/nonempty. |
| `publishedAt` | `string?` | ISO timestamp formatted in explicit timezone; legacy display strings remain literal. |
| `media` | `TweetMedia[] \| null` (optional) | Ordered media. |
| `quoteUrl` | `string?` | Quote link when content is absent or depth-limited. |
| `warnings` | `string[] \| null` (optional) | Host text displayed unchanged. |
| `notices` | `TweetNotice[] \| null` (optional) | Localizable source limitation codes. |
| `metrics` | `TweetMetrics?` | Source-provided counts. |

`TweetMetrics`: optional `likes`, `replies`, `reposts` numbers. Missing values are omitted, never invented as zero; invalid and negative values are ignored.

`TweetNotice = "poll" | "article" | "truncated" | "unsupported-media" | "media-unavailable"`. They map respectively to `poll`, `article`, `incompleteText`, `unsupportedMedia`, and `unavailableMedia` messages.

### Author types

`TweetAuthor`: required `name: string`, `handle: string`; optional `url: string`, `avatarUrl: string`, `verification: TweetVerification`, `affiliation: TweetAffiliation`. `handle` may start with `@`. Without `url`, a valid handle generates an X profile link. A missing/failed avatar does not hide the name or handle.

`TweetVerification = "individual" | "business" | "government"`, rendered with blue, gold, and gray badges respectively. Do not infer verification from a display name.

`TweetAffiliation`: required `imageUrl: string`; optional `name: string`, `url: string`. Displays only source-provided organization identity; a missing URL means a non-link badge. Affiliation is separate from the author's own verification.

### Text segments

```ts
type TweetLinkKind = "link" | "mention" | "hashtag";
interface TweetTextSegment { kind: "text"; text: string; url?: never }
interface TweetLinkSegment { kind: TweetLinkKind; text: string; url: string }
type TweetSegment = TweetTextSegment | TweetLinkSegment;
```

Preserve the entire text in ordered segments, including plain spaces/newlines. Links require a URL; invalid URLs remain non-navigable text. Markup in `text` is not executed.

### Media types

`TweetMediaMetadata`: optional `width: number`, `height: number`, `alt: string`. Missing dimensions do not make media unavailable.

| Type | Fields in addition to `TweetMediaMetadata` |
| --- | --- |
| `TweetPhoto` | `kind: "photo"`, required original `url: string`, optional `thumbnailUrl: string`. |
| `PlayableTweetVideo` | `kind: TweetVideoKind`, required playable `url: string`, optional `thumbnailUrl: string`. |
| `TweetVideoPoster` | `kind: TweetVideoKind`, `url?: never`, required `thumbnailUrl: string`. |
| `TweetVideoKind` | `"video" \| "animated_gif"`. |
| `TweetVideo` | `PlayableTweetVideo \| TweetVideoPoster`. |
| `TweetMedia` | `TweetPhoto \| TweetVideo`. |

Never put a poster image in a video's `url`. Poster-only media displays its poster and source link. Animated GIF media uses a muted looping video, without forcing autoplay. Failed playback retains poster/source access.

### `TweetMediaRenderers`

```ts
interface TweetMediaRenderers {
  renderPhotos?: (photos: TweetPhoto[]) => ReactNode;
  onOpenPhoto?: (photos: TweetPhoto[], index: number, trigger: HTMLElement) => void;
  renderVideo?: (media: TweetVideo) => ReactNode;
}
```

Callbacks receive sanitized media URLs. `renderPhotos` replaces a **consecutive group** of photos, preserving the order relative to videos. With it present, `onOpenPhoto` is not called. `renderVideo` replaces one playable or poster-only video; check `media.url` before assuming playback is possible. The host owns accessibility and interaction for custom renderers.

Without a renderer, photos preserve their original links. A group with known dimensions and a portrait majority uses a horizontal rail (aspect ratios clamped to 0.4–1.8); other groups use a grid, and one photo preserves its ratio. The focusable rail supports native keyboard scrolling, snap alignment, previous/next controls, and reduced-motion scrolling. A quoted tweet is a compact card: its photos become a fixed-size square mosaic beside the text (1, 2, 3 or 4 tiles, `+N` when there are more) and its video shows only the poster linking to the source; the lightbox still receives every photo. `onOpenPhoto` intercepts an ordinary primary click while keeping the default layout. Modified/middle clicks still open links; `trigger` allows focus restoration when your lightbox closes.

## Server API

```ts
import { getTweet, parseTweetId, type GetTweetOptions } from "@violetjs/react-tweet/api";
interface GetTweetOptions { signal?: AbortSignal }
function getTweet(id: string, options?: GetTweetOptions): Promise<TweetData>;
function parseTweetId(value: string): string | null;
```

### `parseTweetId`

Accepts a positive decimal string of 1–20 digits (no leading zero), or an absolute HTTP(S) status URL on `x.com`, `twitter.com`, or their `www` / `mobile` subdomains. Supported paths: `/{handle}/status/{id}` and `/i/web/status/{id}`, optionally followed by `/photo/{number}` or `/video/{number}` and a trailing slash. Query/fragment do not affect the ID. Unsafe URLs, unrelated hosts, non-default ports, and invalid paths return `null`; it does not fetch anything.

### `getTweet`

Invalid ID/URL rejects with `TypeError`. Fetches full text/media from `https://api.fxtwitter.com/status/{id}`. Available posts with source author IDs are supplemented by `https://cdn.syndication.twimg.com/tweet-result` metadata, including quoted authors. Full FxTwitter text is not replaced by potentially truncated syndication text. Source `organization` verification maps to `business`.

Requests omit credentials and reject redirects; no arbitrary origin, authorization header, fetch override, or proxy parameter is exposed. Abort signals apply to fetching and body processing; cancellation is propagated, never turned into an unavailable result. Other network, rate-limit, non-JSON, and malformed-protocol errors reject. FxTwitter HTTP/envelope 401/403/404 become `unavailable` (a 404 alone does not prove deletion); syndication 401/403/404 skip metadata enrichment without discarding the available snapshot. Explicit tombstones/private flags may return `deleted` or `private`; a syndication tombstone returns `unavailable`. Official matching tweet/author IDs can suppress a private snapshot even after a rename; handle consistency gates public metadata enrichment.

Run on the server: syndication is not browser-CORS accessible. Your host manages timeouts, cache, retries, endpoint authentication, and proxy/network configuration. Neither API returns a React element or loads CSS. The API dependency graph has no React runtime import. When using Node environment proxies, use a Node release supporting `NODE_USE_ENV_PROXY=1` and configure `NO_PROXY` for local services; plain proxy environment variables do not enable proxying in every Node version.

## Styling

Cards use `width: 100%`, `min-width: 0`, and no fixed/default maximum width. Set width on your wrapper or via native `className`/`style`. The default theme follows system preference. Ancestor `.light` / `.dark` or `[data-theme="light"]` / `[data-theme="dark"]` select a theme; `data-theme` also works directly on the card. Do not nest conflicting theme ancestors and expect nearest-ancestor precedence.

| Public CSS variable | Purpose |
| --- | --- |
| `--tweet-background` | Card background. |
| `--tweet-foreground` | Body/name text. |
| `--tweet-muted` | Secondary text. |
| `--tweet-border` | Card/media border. |
| `--tweet-surface` | Avatar fallback and secondary surfaces. |
| `--tweet-accent` | Links/actions. |
| `--tweet-accent-hover` | Link hover. |
| `--tweet-focus` | Focus-visible outline. |
| `--tweet-like-hover` | Like hover color. |
| `--tweet-reply-hover` | Reply hover color. |
| `--tweet-repost-hover` | Repost hover color. |
| `--tweet-verified` | Individual verification color. |
| `--tweet-font-family` | Font stack. |
| `--tweet-radius` | Card radius (default 12px, capped at 16px). |

Optional host tokens (`--card`, `--card-foreground`, `--muted-foreground`, `--border`, `--muted`, `--ring`) are used as fallbacks; none is required. Internal `--_tweet-*` variables are not customization API. Default padding is 16px 20px, with compact/quoted variants and narrower mobile padding. SVG resources ship with CSS: preserve relative asset paths or let your bundler rewrite them. No SVG loader is required.

The root entry and CSS are declared side-effectful so production tree shaking retains default styles; `/unstyled` and `/api` do not import CSS. Plain Node must use `/unstyled` rather than the styled root. Import types through the CSS-free declaration entry without ambient CSS module declarations.
