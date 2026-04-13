export interface HttpClient {
    get(url: string, options?: RequestOptions): Promise<HttpResponse>;
    post(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse>;
    put(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse>;
    delete(url: string, options?: RequestOptions): Promise<HttpResponse>;
}

export interface RequestOptions {
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
    responseType?: "json" | "arraybuffer";
}

export interface HttpResponse {
    data: any;
}

export interface HttpError extends Error {
    response: { status: number; data: unknown };
}

export function createHttpClient(
    baseURL = "http://localhost:1234",
    defaultParams?: Record<string, string>,
): HttpClient {
    async function request(
        method: string,
        path: string,
        body?: unknown,
        options?: RequestOptions,
    ): Promise<HttpResponse> {
        const url = new URL(path, baseURL);
        if (defaultParams) {
            for (const [k, v] of Object.entries(defaultParams)) url.searchParams.set(k, v);
        }
        if (options?.params) {
            for (const [k, v] of Object.entries(options.params)) {
                if (v !== undefined) url.searchParams.set(k, String(v));
            }
        }

        const headers: Record<string, string> = { ...options?.headers };
        const isFormData = body instanceof FormData;

        if (body && !isFormData && typeof body === "object") {
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, {
            method,
            headers,
            body: body ? (isFormData ? (body as BodyInit) : JSON.stringify(body)) : undefined,
        });

        if (!response.ok) {
            let errorData: unknown;
            try {
                errorData = await response.json();
            } catch {
                errorData = { message: await response.text().catch(() => "") };
            }
            const err = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError;
            err.response = { status: response.status, data: errorData };
            throw err;
        }

        if (options?.responseType === "arraybuffer") {
            return { data: await response.arrayBuffer() };
        }
        return { data: await response.json() };
    }

    return {
        get: (url, options) => request("GET", url, undefined, options),
        post: (url, body, options) => request("POST", url, body, options),
        put: (url, body, options) => request("PUT", url, body, options),
        delete: (url, options) => request("DELETE", url, undefined, options),
    };
}
