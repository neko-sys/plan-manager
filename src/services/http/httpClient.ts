export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequestConfig = {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly url?: string,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "HttpClientError";
  }
}

type HttpMiddleware = {
  onRequest?: (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>;
  onResponse?: (response: Response, config: HttpRequestConfig) => Response | Promise<Response>;
  onError?: (error: unknown, config: HttpRequestConfig) => void | Promise<void>;
};

class HttpClient {
  private middlewares: HttpMiddleware[] = [];

  use(middleware: HttpMiddleware): void {
    this.middlewares.push(middleware);
  }

  async request(config: HttpRequestConfig): Promise<Response> {
    let currentConfig: HttpRequestConfig = {
      method: "GET",
      timeoutMs: 12_000,
      ...config,
    };

    for (const middleware of this.middlewares) {
      if (middleware.onRequest) {
        currentConfig = await middleware.onRequest(currentConfig);
      }
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), currentConfig.timeoutMs);

    if (currentConfig.signal) {
      if (currentConfig.signal.aborted) {
        window.clearTimeout(timeout);
        throw new DOMException("Request was aborted", "AbortError");
      }
      currentConfig.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      let response = await fetch(currentConfig.url, {
        method: currentConfig.method,
        headers: currentConfig.headers,
        body: currentConfig.body,
        signal: controller.signal,
      });

      for (const middleware of this.middlewares) {
        if (middleware.onResponse) {
          response = await middleware.onResponse(response, currentConfig);
        }
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new HttpClientError(
          `HTTP ${response.status}`,
          response.status,
          currentConfig.url,
          bodyText,
        );
      }

      return response;
    } catch (error) {
      for (const middleware of this.middlewares) {
        if (middleware.onError) {
          await middleware.onError(error, currentConfig);
        }
      }
      if (error instanceof HttpClientError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      throw new HttpClientError(
        error instanceof Error ? error.message : "Network request failed",
        undefined,
        currentConfig.url,
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async requestJson<T>(config: HttpRequestConfig): Promise<T> {
    const response = await this.request({
      ...config,
      headers: {
        Accept: "application/json",
        ...(config.headers ?? {}),
      },
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return text as T;
    }

    return (await response.json()) as T;
  }
}

const makeRequestId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}`;
};

export const httpClient = new HttpClient();

httpClient.use({
  onRequest: (config) => ({
    ...config,
    headers: {
      "X-Request-Id": makeRequestId(),
      ...(config.headers ?? {}),
    },
  }),
});
