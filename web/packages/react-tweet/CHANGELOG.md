# Changelog

All notable changes to `@violetjs/react-tweet` are documented here. Versions follow [Semantic Versioning](https://semver.org/); before 1.0.0, a minor version may include breaking changes.

## 0.2.0 - 2026-10-13

### Added

- `EmbeddedTweet` supports `quoted` for a small card with thumbnail media, hidden X branding and engagement counts, and a body capped at four lines before expansion. Nested quotes use the same layout.
- Animated GIFs play muted on a loop with a GIF badge. Inside a rail only the most visible GIF plays, and a manual pause is respected.
- Videos show their poster, a play button and the duration before playback, and switch to native controls once started.
- Consecutive videos and GIFs share a horizontal rail sized like X: about 0.675 of the content width tall, at most 384px, with cards no wider than 1.18 times their height.
- `playVideo` message for the video play button.

### Changed

- A single photo keeps its own aspect ratio and aligns to the start instead of being centered on a filled background.
- Rail cards are capped at 80% of the row so the next card always peeks, and the rail buttons step card by card.
- Videos and GIFs with known dimensions reserve their aspect ratio, so swapping the poster for the video no longer resizes them.
- Media without a playable source shows "Watch on X" as a badge on the poster.

### Documentation

- Update English and Simplified Chinese usage/API documentation for quoted cards, media rails, GIF visibility and pause behavior, native video controls, and media delivery limits.
- Add an executable quoted-card example, synchronized into both READMEs and checked against the installed tarball.

### Notes

- Direct `video.twimg.com` sources can reject browser requests carrying a third-party `Referer` and fall back to the poster/source link. Fetching with the server-side FxTwitter adapter does not proxy media; provide a browser-accessible media URL through your own proxy, or connect your player and delivery through `renderVideo`.

## 0.1.0 - 2026-10-11

First public release.

- Render saved snapshots with `EmbeddedTweet`, load through a host-provided `TweetFetcher` with `Tweet`, or compose source-independent content with `TweetCard`.
- Include standalone light/dark styling, explicit locale/timezone formatting, English and Simplified Chinese messages, and CSS variable customization.
- Support one-level quotes, body-text expansion, native media, portrait photo rails, custom media renderers, and lightbox callbacks.
- Preserve explicit unavailable/private/deleted states and provide cancellable async loading with manual retries.
- Fetch full text and media with the server-side FxTwitter adapter, supplemented by official X author verification and affiliation metadata.
- Provide ESM and TypeScript declarations, styled/unstyled/API entry points, bundled SVG assets, and an explicit CSS entry.
- Include bilingual usage/API documentation, executable examples with generated preview provenance, and independent tarball consumer checks.
