export const announcementKeys = {
  all: ["announcements"] as const,
  list: (page: number, limit: number) => [...announcementKeys.all, "list", page, limit] as const,
  active: () => [...announcementKeys.all, "active"] as const,
};