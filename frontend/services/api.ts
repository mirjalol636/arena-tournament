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
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: "Connection failed" }));
    throw new Error(
      Array.isArray(body.detail)
        ? body.detail.map((d: { msg: string }) => d.msg).join(". ")
        : body.detail || "Something went wrong",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const mutate = <T>(path: string, data: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(data) });
