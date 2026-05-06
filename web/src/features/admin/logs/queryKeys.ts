export const logKeys = {
  all: ["logs"] as const,
  list: () => [...logKeys.all, "list"] as const,
  byUser: (userId: string) => [...logKeys.all, "user", userId] as const,
};