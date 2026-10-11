# Changelog

All notable changes to `@violetjs/react-tweet` are documented here. Versions follow [Semantic Versioning](https://semver.org/); before 1.0.0, a minor version may include breaking changes.

## 0.1.0 - Unreleased

First public release.

- Render saved snapshots with `EmbeddedTweet`, load through a host-provided `TweetFetcher` with `Tweet`, or compose source-independent content with `TweetCard`.
- Include standalone light/dark styling, explicit locale/timezone formatting, English and Simplified Chinese messages, and CSS variable customization.
- Support one-level quotes, body-text expansion, native media, portrait photo rails, custom media renderers, and lightbox callbacks.
- Preserve explicit unavailable/private/deleted states and provide cancellable async loading with manual retries.
- Fetch full text and media with the server-side FxTwitter adapter, supplemented by official X author verification and affiliation metadata.
- Provide ESM and TypeScript declarations, styled/unstyled/API entry points, bundled SVG assets, and an explicit CSS entry.
- Include bilingual usage/API documentation, executable examples with generated preview provenance, and independent tarball consumer checks.
