import { apiMessage } from "@/lib/errors";
let token: string | null = null;
export const setToken = (value: string | null) => {
  token = value;
};
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).catch(() => { throw new Error("Internet aloqasini tekshiring va qayta urinib ko‘ring."); });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: "Connection failed" }));
    throw new Error(apiMessage(body.detail,response.status));
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const mutate = <T>(path: string, data: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(data) });
