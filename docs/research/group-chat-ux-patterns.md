# Group/private chat UX patterns

**Purpose.** First-party evidence to sharpen the repository's group/private-chat UI. Sources below are official product help, support, or product-blog pages. A **Fact** is directly stated by the source; a **Recommendation** is an interpretation for this repository and is not a claim about any vendor's implementation. Product limits and labels change, so treat examples as interaction patterns rather than API requirements.

## Executive summary

Across the products reviewed, the durable pattern is a single conversation surface with explicit context boundaries:

- A **conversation list** is the primary place to resume work; creation is a prominent compose/plus action rather than a separate settings workflow.
- **Private 1:1, named group, and larger channel/community contexts** are differentiated at creation time and in the list/header, not only by permissions hidden in a menu.
- **Unread is actionable state**, not merely a color: Slack and Signal provide dedicated unread views/filters, while Telegram uses notification/mute rules and Discord exposes mute and DM-list actions.
- **Search is global or scoped with useful narrowing.** Slack exposes `in:`, `from:`, date, thread, DM, and saved/pinned modifiers; Telegram documents instant search plus sender filtering.
- **Member management lives behind the room header/name** on mobile and in a header action row/sidebar on desktop. Naming, members, invite links, mute, and pins are room-level operations.
- **Responsive behavior is a navigation transformation:** desktop can show a sidebar/list beside the conversation; mobile collapses room actions behind the conversation title and uses a compose button or mobile tab.

The safest repository direction is therefore to preserve one conversation list and one conversation view while making context, creation, unread, search, and member actions explicit and consistent across viewport sizes.

## Source-backed findings

### Slack — channel/DM separation, named groups, search, and catch-up

**Facts**

- Slack describes channels as the way to keep conversations organised, and says members can create channels by default (owners can restrict that permission). [Create a channel](https://slack.com/help/articles/201402297-Create-a-channel)
- Slack defines DMs as smaller conversations outside channels; a DM can be 1:1 or include up to nine people. Slack explicitly supports naming a group DM, adding people to a DM, and converting a group DM to a private channel. The desktop entry point is a sidebar plus button; mobile uses a compose button. [Understand direct messages](https://slack.com/help/articles/212281468-Understand-direct-messages)
- Slack's search is a searchable archive and supports scope and semantic modifiers such as `in:`, `from:`, `has:`, `before:`, `after:`, `is:thread`, `with:`, `is:saved`, and `has:pin`. It also allows searching inside a specific channel or DM and retains search history. [Search in Slack](https://slack.com/help/articles/202528808-Search-in-Slack)
- Slack has a dedicated **Unread messages** view on desktop and **Catch up** on mobile. The view can mark messages read, react, reply/start a thread, take message actions, and jump to the channel/DM. Desktop supports sorting and filtering unreads; the source calls out that those sorting/filtering options are desktop-only. [View all your unread messages](https://slack.com/help/articles/226410907-View-all-your-unread-messages)

**Interaction pattern / problem solved**

- **Pattern:** Keep DMs and channels in the same navigation system, but communicate the distinction and allow escalation (group DM → named group → private channel). This solves the “where should this conversation live?” problem without forcing a user to preconfigure a workspace.
- **Pattern:** Put create DM/channel controls in the list/sidebar and expose room management from the header. This shortens the path from “I need to talk” to a new conversation.
- **Pattern:** Treat unread as a queue users can triage rather than a passive badge. This solves notification overload and lets users resume across many contexts.

**Repository applicability / risk (recommendation)**

- Provide one obvious **New conversation** action with an early choice between private 1:1, named group, and channel-like room if the product supports all three. Do not silently create a private room when the user intended a shared channel.
- Add scoped search (`in room`, `from member`, date) before attempting broad AI-style search. Risk: adopting Slack's large modifier grammar without the same search index can create misleading affordances; start with a small set of visible filters.
- Add an unread-only list/filter if the repository's chat list can contain enough rooms to make scanning difficult. Keep the per-room unread indicator as the fast signal; the filter is the recovery path.

### Discord — group DM creation from friends or an existing 1:1, room header management, mobile parity

**Facts**

- Discord's official guide says Group DMs are for direct coordination without creating a server. They start from the Friends List; the desktop flow offers **New Group DM**, friend search/selection, and **Create Group DM**. On mobile, users open DMs with the speech-bubble icon, select **New Group DM**, choose friends, and confirm. [Group Chat and Calls](https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls)
- Discord also allows creating a new group DM from an existing 1:1 DM; the existing 1:1 is not affected. The source documents an explicit **Add Friends to DM** action on desktop and a group option from the mobile conversation header. [Group Chat and Calls](https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls)
- Discord's documented Group DM limit is 10 members including the current user. For larger groups, Discord directs users to create a server. [Group Chat and Calls](https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls)
- Group-level actions include mute notifications, pinned messages, member list, add members, rename, custom icon, remove member, and leave. Desktop shows actions in a top-right row/sidebar; mobile places some options behind tapping the conversation name. Only the creator can remove members; any member can leave. [Group Chat and Calls](https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls)

**Interaction pattern / problem solved**

- **Pattern:** Support both “create from people” and “expand this conversation” entry points. This solves the common interruption where a user is already in a 1:1 and needs to bring in others, without mutating the original private context.
- **Pattern:** Use the room title as the mobile gateway to management, preserving the narrow mobile message viewport while keeping desktop actions discoverable.
- **Pattern:** Make the context boundary explicit at the scale limit: small group DM versus larger server/channel. This prevents an unbounded group model from becoming ambiguous.

**Repository applicability / risk (recommendation)**

- If group creation is available from a 1:1, create a new room and preserve the original 1:1's identity/history. Do not reinterpret the existing room in place.
- Put room name, member list, invite/add, mute, and leave in the room header menu; ensure mobile has the same actions behind the title. Risk: creator-only removal rules may not fit this repository's authorization model, so derive permissions from the backend rather than copying Discord's owner rule.
- If the app has no server/channel tier, avoid importing Discord's 10-member boundary; use the repository's actual domain limit and explain it at selection time.

### Telegram — explicit group/channel split, search, mute semantics, multi-device behavior

**Facts**

- Telegram says groups are for friends/family and small-team collaboration (and can grow to 200,000 members), while channels are for broadcasting to unlimited audiences. Groups can be public, have persistent-history controls, administrators, pinned messages, and granular permissions. [Telegram FAQ — groups and channels](https://telegram.org/faq#groups-and-channels)
- Telegram documents platform-specific creation entry points: iOS **New message → New Group**, Android the circular pencil in the chat list → **New Group**, and Desktop the top-left menu → **New Group**. [Telegram FAQ — create a group](https://telegram.org/faq#q-how-do-i-create-a-group)
- Telegram documents adding members either from contacts or by username search, and creating an invite link from **Group Info → Add Member → Invite to Group via Link**; links can be revoked immediately. [Telegram FAQ — members and invite links](https://telegram.org/faq#q-how-do-i-add-more-members-what-39s-an-invite-link)
- Telegram advertises instant search, sender filtering, replies/mentions/hashtags, pinned messages, and “smart notifications” where muting a group can leave notifications for mentions or replies. [Telegram FAQ — group features](https://telegram.org/faq#q-what-makes-telegram-groups-cool)
- Telegram states that messages sync across any number of phones, tablets, and computers and lists native mobile, desktop, and web apps. [Telegram FAQ — supported devices](https://telegram.org/faq#q-which-devices-can-i-use)

**Interaction pattern / problem solved**

- **Pattern:** Separate “conversation among members” from “broadcast to subscribers” at the product-model level. This solves discoverability and expectation problems that a single generic “room” cannot.
- **Pattern:** Let users find/add people through both local contacts and username search, then manage membership through room info and revocable links. This balances convenience with control.
- **Pattern:** Give mute behavior semantic meaning (mentions/replies still notify) instead of treating mute as an all-or-nothing hidden switch.

**Repository applicability / risk (recommendation)**

- Model room type explicitly in the creation UI only if the repository has a real broadcast/channel use case. Otherwise, a smaller private/group split is clearer than a speculative third context.
- If usernames or directory search already exist, reuse them for member selection and scoped search; do not add a second “invite” search model. Always provide a visible revocation/permission path for links.
- Preserve cross-device state for room selection, unread, and mute if the app promises synced chat. Risk: Telegram's huge-group and topic features are not a reason to add complexity without matching backend/search/index support.

### Signal — private group metadata, explicit creation, admin controls, unread filter on mobile and desktop

**Facts**

- Signal says its service has no record of group memberships, titles, avatars, or attributes. It documents groups with descriptions, invite links/QR codes, admin removal and permissions, optional approval for link joins, and a size limit of 1000. [Group chats](https://support.signal.org/hc/en-us/articles/360007319331-Group-chats)
- Signal's documented creation flow is **Compose → New Group → select contacts/numbers → Next → Group name → disappearing-message time → Create**. The new group immediately appears in the chat lists. [Group chats](https://support.signal.org/hc/en-us/articles/360007319331-Group-chats)
- Signal has a dedicated unread filter on both platforms: on Android/iOS pull down in the chat list; on desktop use the filter button next to the search bar. [Filtered by unread](https://support.signal.org/hc/en-us/articles/8406572577818-Filtered-by-unread)
- Signal's group-management documentation covers adding members, changing name/photo/description, admin controls, and group links/QR codes with optional approval. [Manage a group](https://support.signal.org/hc/en-us/articles/360050427692) · [Group link or QR-code](https://support.signal.org/hc/en-us/articles/360051086971)

**Interaction pattern / problem solved**

- **Pattern:** Make group creation a short, linear wizard that captures members and a name before the room enters the list. This solves unnamed-room ambiguity and avoids a half-created room.
- **Pattern:** Make unread filtering available on mobile with a gesture and on desktop beside search. This solves the “many rooms, small screen” problem without requiring a separate inbox page.
- **Pattern:** Treat member/metadata management as admin-governed room settings, not as message-level actions.

**Repository applicability / risk (recommendation)**

- Require a meaningful group name (or an explicit, deterministic fallback) before insertion into the conversation list. Show the resulting room immediately after creation so the user has a clear success state.
- A chat-list unread filter is a high-value, low-conceptual-cost feature for this repository if unread state exists. Provide an accessible button in addition to pull-to-refresh/gesture behavior; gestures alone are undiscoverable on web/desktop.
- Do not imply Signal-like privacy properties unless the repository's actual storage and encryption architecture supports them. Keep UX recommendations separate from security claims.

### Microsoft Teams — team/channel hierarchy, channel privacy types, list organization

**Facts**

- Microsoft distinguishes standard, private, and shared channels. Standard channels are open to all team members and their posts are searchable by others; private channels require invitation; shared channels are for collaboration with people inside and outside the team or organization. [Standard, private, or shared channels](https://support.microsoft.com/en-us/teams/teams-channels/standard-private-or-shared-channels-in-microsoft-teams)
- Microsoft says channel creation permissions vary by type and owner/admin policy, and that standard/private/shared channels cannot be converted into one another. [Standard, private, or shared channels](https://support.microsoft.com/en-us/teams/teams-channels/standard-private-or-shared-channels-in-microsoft-teams)
- The Teams support navigation groups operations into create, manage, participate, organize, and “catch up” sections; it includes show/hide/favorite/reorder channel/list operations and a dedicated catch-up article. [Teams channels support hub](https://support.microsoft.com/en-us/teams/teams-channels)

**Interaction pattern / problem solved**

- **Pattern:** Use a hierarchy (team → channel) when a product needs a stable parent context plus multiple rooms. This reduces one giant flat list, but makes switching context a first-class navigation problem.
- **Pattern:** Put visibility/searchability rules into channel type and permission policy, not only into a visual badge. This prevents users from assuming that a private room is discoverable to all team members.
- **Pattern:** Support show/hide/favorite/reorder to let users turn a large navigation tree into a personal working set.

**Repository applicability / risk (recommendation)**

- Adopt a parent hierarchy only if the repository has a real tenant/project/team concept. Otherwise, a flat list with sections is cheaper to learn and easier to make responsive.
- Display privacy scope near room creation and in the room header. Disable or hide type changes when the domain cannot safely migrate permissions/history; never present a reversible-looking control for an irreversible operation.
- If the list grows, add favorites/pinning and hide/archive behavior before adding complex nested navigation. Risk: Teams-like hierarchy can make private/group switching harder on mobile if the parent and room selectors both consume the top bar.

### WhatsApp — group/community framing and official creation surface

**Facts**

- WhatsApp's official Help Center publishes a platform-specific article titled **How to create and invite into a group**, under its web/chats help surface. [How to create and invite into a group](https://faq.whatsapp.com/web/chats/how-to-create-and-invite-into-a-group/)
- WhatsApp's official product page describes group messaging for personal, team, and community communication across iPhone, Android, and desktop. [WhatsApp Groups](https://www.whatsapp.com/groups)
- WhatsApp's official Communities announcement frames Communities as a way to organize conversations among an individual, a group of friends/family, and a broader community. [Sharing Our Vision for Communities on WhatsApp](https://blog.whatsapp.com/sharing-our-vision-for-communities-on-whatsapp)

**Interaction pattern / problem solved**

- **Pattern:** Preserve the familiar chat list while introducing a higher-level community container for related groups. This solves the need to coordinate multiple group contexts without merging their membership or histories.

**Repository applicability / risk (recommendation)**

- If the repository has related rooms under a project/organization, consider an optional section/container rather than forcing users to choose between “private” and “channel” for every message. Keep room membership and unread state independently visible.
- The Help Center page is JS-rendered in the available reader, so this note intentionally does **not** treat undocumented step details, limits, or badge semantics as verified facts. Confirm current WhatsApp behavior in a live product before copying any exact labels.

## Cross-product recommendations for this repository

These are recommendations synthesized from the facts above, not vendor requirements:

1. **Conversation list as home.** Keep the list visible on desktop and make it the first screen on mobile. Show avatar/icon, stable room name, last-message preview/time, unread count or dot, and a privacy/type marker where ambiguity is likely.
2. **One creation affordance, explicit type.** Use one prominent New/Compose action. If more than one context exists, ask for 1:1 vs group vs channel before member selection; then use a short member picker and a required/derived room name. Preserve an existing 1:1 when expanding it into a group.
3. **Search with progressive scope.** Start with one global search field and offer filters for room, sender, date, and message/file type only when supported by the data layer. Include an in-room search affordance from the conversation header. Avoid exposing unsupported modifier syntax.
4. **Unread as a recoverable workflow.** Keep local list markers, add an unread-only filter/view, and make mark-read/mark-unread explicit. On mobile, use a visible filter control in addition to any pull gesture. Distinguish unread from mention/priority if the backend tracks both.
5. **Room header as the management seam.** The header should expose or lead to room name, member list, add/invite, mute/notification policy, pinned items, and leave/archive. On mobile, tapping the room title is a reasonable compact gateway; all critical actions must remain keyboard- and screen-reader-accessible on web.
6. **Member and privacy clarity.** Show who can see a room and who can add/remove members at the point of action. Use server-authoritative permissions; do not copy owner/admin limits from another product without matching domain rules.
7. **Responsive context switching.** Desktop may use a persistent list plus content pane. Mobile should collapse to one pane with a back affordance and preserve the list/header state. Do not hide the only way to switch between private and group contexts inside a deep settings screen.
8. **Avoid speculative complexity.** Topics, broadcast channels, communities, cross-org rooms, invite links, and advanced search are worthwhile only when the repository's domain and backend support them. A small, coherent private/group model is preferable to a visually rich but semantically ambiguous clone of a larger product.

## Evidence quality and limits

- All cited sources are first-party product documentation or product-owned pages from Discord, Slack, Telegram, Signal, Microsoft, or WhatsApp.
- Vendor UI changes frequently; exact icon placement and mobile labels are evidence of the cited source's documented flow, not a promise of permanent UI stability.
- Recommendations deliberately avoid asserting that the repository already has a particular permission model, search index, encryption design, or unread data contract. Those choices must be reconciled with the codebase survey before implementation.
