const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("admin_token");
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("admin_token");
}

export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getAdminToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    clearAdminToken();
    window.location.href = "/admin/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`Admin API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
