import type { AxiosInstance } from "axios";

export class ServerModule {
    constructor(private readonly http: AxiosInstance) {}

    async getServerInfo(): Promise<any> {
        const response = await this.http.get("/api/v1/server/info");
        return response.data.data;
    }

    async getMessageStats(): Promise<any> {
        const response = await this.http.get("/api/v1/server/statistics/totals");
        return response.data.data;
    }

    async getServerLogs(count?: number): Promise<string[]> {
        const response = await this.http.get("/api/v1/server/logs", {
            params: count !== undefined ? { count } : {},
        });
        return response.data.data;
    }

    async getMediaStatistics(options?: { only?: string[] }): Promise<any> {
        const params: Record<string, any> = {};
        if (options?.only) params.only = options.only.join(",");

        const response = await this.http.get("/api/v1/server/statistics/media", {
            params,
        });
        return response.data.data;
    }

    async getMediaStatisticsByChat(options?: { only?: string[] }): Promise<any> {
        const params: Record<string, any> = {};
        if (options?.only) params.only = options.only.join(",");

        const response = await this.http.get("/api/v1/server/statistics/media/chat", {
            params,
        });
        return response.data.data;
    }
}
