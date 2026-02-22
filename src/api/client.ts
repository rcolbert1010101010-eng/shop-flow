const DEFAULT_API_BASE_URL = "/api/v1";
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL;

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, body } = options;

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Id": "dev-tenant",
    ...headers,
  };

  // Optional stub auth – will be replaced with real auth later
  try {
    const token = window.localStorage.getItem("authToken");
    if (token) {
      baseHeaders["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // Ignore storage errors in non-browser environments
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: baseHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let parsed: unknown = null;
  const isJson = response.headers.get("content-type")?.includes("application/json");
  if (isJson && response.status !== 204) {
    parsed = await response.json();
  }

  if (!response.ok) {
    const message =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as any).error === "string"
        ? (parsed as any).error
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return parsed as T;
}

export const apiClient = {
  get<T>(path: string) {
    return request<T>(path);
  },
  post<T, B = unknown>(path: string, body: B) {
    return request<T>(path, { method: "POST", body });
  },
  put<T, B = unknown>(path: string, body: B) {
    return request<T>(path, { method: "PUT", body });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },
};
