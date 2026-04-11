export const BASE_PATH =
  typeof window === "undefined"
    ? process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai"
    : (process.env.NEXT_PUBLIC_BASE_PATH ?? "/bpai");

export function apiPath(path: string): string {
  return BASE_PATH + path;
}
