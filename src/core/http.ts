import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";

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

class AxiosHttpClient implements HttpClient {
  constructor(private readonly instance: AxiosInstance) {}

  async request<T = unknown>(url: string, method: HttpMethod, options: HttpRequestOptions = {}): Promise<{ status: number; headers: Record<string, string>; data: T }> {
    const config: AxiosRequestConfig = {
      url,
      method,
      headers: options.headers as any,
      params: options.query,
      data: options.body,
      timeout: options.timeoutMs,
      transitional: { clarifyTimeoutError: true },
      // Keep response as JSON when possible
      responseType: "json",
      validateStatus: () => true,
    } as AxiosRequestConfig;
    const res: AxiosResponse<T> = await this.instance.request<T>(config);
    // Normalize headers to string record
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    return { status: res.status, headers, data: res.data };
  }
}

export const defaultHttpClient: HttpClient = new AxiosHttpClient(axios.create());

export function createHttpClient(config?: AxiosRequestConfig): HttpClient {
  return new AxiosHttpClient(axios.create(config));
}

