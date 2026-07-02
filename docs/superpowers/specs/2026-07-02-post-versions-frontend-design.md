# Post Versions Frontend Design

## 1. Overview
This feature adds a UI for authors to view and restore historical versions (snapshots) of their blog posts directly from the frontend admin editor, without disrupting the writing flow.

## 2. Architecture & Approach
The feature will use a **Sheet (Drawer) mode** integrated into the existing `PostEditor`.

### 2.1 Entry Point
- **Location**: `features/admin-posts/ui/PostEditorToolbar.tsx`.
- **Component**: A new "历史版本" (History) button with a `History` icon from `lucide-react`.
- **Visibility**: Displayed only when `isEdit === true` (editing an existing post, not creating a new one) and not currently saving.

### 2.2 Data Layer (API Hooks)
New React Query hooks will be added to `features/admin-posts/api/`:
- `usePostVersions(postId)`: Queries `/admin/posts/{id}/versions` to list all snapshots.
- `usePostVersion(versionId)`: Queries `/admin/posts/versions/{versionId}` to fetch the full markdown content of a snapshot.
- `useRestoreVersion(postId, versionId)`: Mutates via `/admin/posts/{id}/versions/{versionId}/restore` to revert the post to a previous state.

### 2.3 Core Components
- **`PostVersionsSheet`** (`features/admin-posts/ui/PostVersionsSheet.tsx`)
  - A slide-out drawer (using `@shared/ui/sheet`) on the right side of the screen.
  - Displays a timeline or list of versions.
  - Each item shows the `summary` (e.g., "自动保存", "初始版本"), `created_at` (formatted), and the author ID.
- **`VersionPreviewDialog`** (Internal to `PostVersionsSheet` or as a separate component)
  - Uses `@shared/ui/dialog` to show a modal when a version is clicked in the Sheet.
  - Displays the readonly markdown content of that specific version.
  - Contains a primary action button: "恢复至此版本" (Restore to this version).

## 3. Data Flow & State Management
1. User clicks "历史版本" -> `PostVersionsSheet` opens.
2. `usePostVersions` fetches and displays the list of versions.
3. User clicks a version item -> `VersionPreviewDialog` opens and triggers `usePostVersion` to load the full text.
4. User clicks "恢复至此版本" -> `useRestoreVersion` triggers the rollback endpoint.
5. On rollback success:
   - The dialog and sheet close.
   - `queryClient.invalidateQueries` is called for the specific post's query key (from `useAdminPost`).
   - The `PostEditor` automatically reacts to the updated data and repopulates the title and content.
   - A success toast is shown.

## 4. UI Library Dependencies
- `@shared/ui/sheet`
- `@shared/ui/dialog`
- `@shared/ui/button`
- `lucide-react` (for icons)
- `sonner` (for toast notifications)

## 5. Scope & Constraints
- Diffing: Visual diffing (side-by-side highlighting) is out of scope for this iteration to keep implementation simple and reliable. We will rely on previewing the full text.
- Pagination: The backend currently returns all versions for a post (ordered newest first), so frontend pagination inside the Sheet is not strictly necessary for v1.
