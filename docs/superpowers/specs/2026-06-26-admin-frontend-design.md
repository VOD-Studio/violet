# Admin Frontend Design

## Overview
This specification outlines the architecture and initial features for the new Management Backend Frontend (`/admin`). The admin interface will be integrated into the existing `web/` React application, utilizing the current technology stack (`@tanstack/react-router`, `@tanstack/react-query`, Tailwind CSS).

## Architecture & Layout
- **Route Namespace**: All admin features will live under the `/admin` route namespace.
- **Layout Component (`_admin.tsx`)**: 
  - **Sidebar**: A fixed left sidebar for navigation between different administrative modules.
  - **Header**: A top navigation bar containing breadcrumbs, user profile, and potentially a theme toggle or global search.
  - **Main Content Area**: The central area where module-specific content is rendered.

## Core Component: DataTable
To ensure consistency and ease of use across the admin panel, a robust, reusable `<DataTable>` component will be implemented.

- **Technology**: Built using headless logic from `@tanstack/react-table` combined with UI primitives based on Shadcn UI (`Table`, `TableHeader`, `TableRow`, `TableCell`).
- **Required Features**:
  - **Pagination**: Built-in controls for navigating pages and selecting page sizes.
  - **Sorting**: Clickable column headers to toggle ascending/descending order.
  - **Row Selection**: Checkboxes for selecting individual or all rows, exposing the selected state to parent components.
  - **Sticky Columns**: Support for pinning specific columns (like actions or checkboxes) to the left or right side during horizontal scrolling.
  - **Custom Rendering**: Ability to pass custom cell renderers for specific column types (e.g., avatar images, status badges, action buttons).

## Initial Modules

### 1. User & Permission Management (`/admin/users`)
- **Purpose**: Manage platform users and their assigned roles.
- **UI Elements**: 
  - Uses the new `<DataTable>` to display the user list.
  - Columns: Avatar, Nickname, Email, Role, Joined Date, Actions.
- **Features**:
  - Paginated list of users.
  - Ability to sort by join date or email.
  - Action to modify a user's role.

### 2. Emoji Management (`/admin/emojis`)
- **Purpose**: Manage system and custom emojis used in comments or posts.
- **UI Elements**:
  - Uses the new `<DataTable>` to display emojis.
  - Columns: Preview (Image), Code (e.g., `:smile:`), Created At, Actions.
- **Features**:
  - View list of emojis.
  - Delete an emoji.
  - (Future) Upload new custom emojis.
