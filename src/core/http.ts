export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  timeoutMs?: number;
}

export interface HttpClient {
  request<T = unknown>(url: string, method: HttpMethod, options?: HttpRequestOptions): Promise<{ status: number; headers: Record<string, string>; data: T }>;
}

export interface FetchHttpClientConfig {
  /** Optional base URL used when requests provide relative paths. */
  baseUrl?: string;
  /** Headers applied to every request unless overridden. */
  defaultHeaders?: Record<string, string>;
  /** Default timeout in milliseconds applied when a request omits one. */
  timeoutMs?: number;
  /** Custom fetch implementation for environments without a global fetch. */
  fetchImplementation?: typeof fetch;
}

function buildUrl(baseUrl: string | undefined, url: string, query?: Record<string, string | number | boolean | undefined>): string {
  let target: URL;
  if (baseUrl) {
    target = new URL(url, baseUrl);
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    target = new URL(url);
  } else {
    throw new Error("Relative URLs require a baseUrl to be configured");
  }
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      target.searchParams.set(key, String(value));
    }
  }
  return target.toString();
}

function createHeaders(defaultHeaders?: Record<string, string>, requestHeaders?: Record<string, string>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(defaultHeaders ?? {})) {
    headers.set(key, value);
  }
  for (const [key, value] of Object.entries(requestHeaders ?? {})) {
    headers.set(key, value);
  }
  return headers;
}

function prepareBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;

  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body;
  if (typeof FormData !== "undefined" && body instanceof FormData) return body;
  if (typeof Blob !== "undefined" && body instanceof Blob) return body;
  if (ArrayBuffer.isView(body)) return body as unknown as BodyInit;
  if (body instanceof ArrayBuffer) return body;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream) return body;

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return JSON.stringify(body);
}

async function parseResponseBody<T>(response: Response, method: HttpMethod): Promise<T> {
  if (method === "HEAD") {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  try {
    if (contentType.includes("application/json") || contentType.includes("+json")) {
      return (await response.json()) as T;
    }
  } catch (error) {
    // Fallback to text parsing below
  }

  if (contentType.startsWith("text/")) {
    return (await response.text()) as T;
  }

  // Default to ArrayBuffer for non-text responses
  return (await response.arrayBuffer()) as T;
}

class FetchHttpClient implements HttpClient {
  constructor(private readonly config: FetchHttpClientConfig = {}) {}

  async request<T = unknown>(url: string, method: HttpMethod, options: HttpRequestOptions = {}): Promise<{ status: number; headers: Record<string, string>; data: T }> {
    const fetchImpl = this.config.fetchImplementation ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("fetch is not available in this environment. Provide a fetchImplementation via FetchHttpClientConfig.");
    }

    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    if (controller && typeof timeoutMs === "number" && Number.isFinite(timeoutMs)) {
      timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
      const targetUrl = buildUrl(this.config.baseUrl, url, options.query);
      const headers = createHeaders(this.config.defaultHeaders, options.headers);
      const body = prepareBody(options.body, headers);

      const init: RequestInit = {
        method,
        headers,
      };
      if (controller) {
        init.signal = controller.signal;
      }
      if (body !== undefined) {
        init.body = body;
      }

      const response = await fetchImpl(targetUrl, init);

      const headersRecord: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersRecord[key.toLowerCase()] = value;
      });

      const data = (await parseResponseBody<T>(response, method)) as T;
      return { status: response.status, headers: headersRecord, data };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

export const defaultHttpClient: HttpClient = new FetchHttpClient();

export function createHttpClient(config: FetchHttpClientConfig = {}): HttpClient {
  return new FetchHttpClient(config);
}

