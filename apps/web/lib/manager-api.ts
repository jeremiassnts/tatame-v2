const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function managerFetch<T>(
  path: string,
  token: string | null,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // The API puts a machine-readable code in `error` whenever it has one and
    // the sentence for the reader in `message`, so reading `error` first is how
    // a refusal like ALREADY_SUBSCRIBED used to reach the screen as its own
    // code. Errors that carry no code repeat the sentence in both fields, so
    // preferring `message` changes nothing for them.
    throw new Error(body.message || body.error || `API error ${res.status}`);
  }

  return res.json();
}
