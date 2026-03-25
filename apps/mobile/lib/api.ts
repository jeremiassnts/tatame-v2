import { useAuth } from "@clerk/clerk-expo";

const API_BASE_URL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/v1";

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

async function request<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, error.error ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const MAX_SYNC_RETRIES = 3;

/**
 * Sync current Clerk user to our database. Plain function (not a hook)
 * so it can be called from event handlers. Pass the token from getToken().
 * Retries up to 3 times on failure before throwing.
 */
export async function syncUser(
  token: string,
  role?: string | null,
): Promise<void> {
  const body: Record<string, string> = {};
  if (role) body.role = role;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
    try {
      await request("/users/me/sync", { method: "POST", body, token });
      return;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError && err.status === 400) throw err;
      if (attempt < MAX_SYNC_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

export function useApi() {
  const { getToken } = useAuth();

  return {
    async get<T>(path: string): Promise<T> {
      const token = await getToken();
      return request<T>(path, { token });
    },

    async post<T>(path: string, body?: unknown): Promise<T> {
      const token = await getToken();
      return request<T>(path, { method: "POST", body, token });
    },

    async patch<T>(path: string, body?: unknown): Promise<T> {
      const token = await getToken();
      return request<T>(path, { method: "PATCH", body, token });
    },

    async uploadImage(file: {
      uri: string;
      type: string;
      name: string;
    }): Promise<{ url: string }> {
      const token = await getToken();
      const formData = new FormData();
      formData.append("image", {
        uri: file.uri,
        type: file.type,
        name: file.name,
      } as unknown as Blob);
      return request("/uploads/image", { method: "POST", body: formData, token });
    },
  };
}
