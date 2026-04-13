import type { HttpClient } from "../lib/http";

export class FaceTimeModule {
    constructor(private readonly http: HttpClient) {}

    async createFaceTimeLink(): Promise<string> {
        const response = await this.http.post("/api/v1/facetime/session");
        return response.data.data;
    }
}
