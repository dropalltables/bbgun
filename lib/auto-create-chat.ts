import type { HttpClient } from "./http";

export function isChatNotExistError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const response = (error as { response?: { data?: unknown } }).response;
    if (!response?.data || typeof response.data !== "object") return false;
    const data = response.data as Record<string, unknown>;
    const nested =
        typeof data.error === "object" && data.error !== null ? (data.error as Record<string, unknown>) : null;
    const errorMsg = String(nested?.message ?? data.message ?? "");
    const lowerMsg = errorMsg.toLowerCase();
    return lowerMsg.includes("chat does not exist") || lowerMsg.includes("chat not found");
}

export function extractAddress(chatGuid: string): string | undefined {
    const parts = chatGuid.split(";-;");
    if (parts.length !== 2 || !parts[1]) {
        return undefined;
    }
    return parts[1];
}

export function extractService(chatGuid: string): "iMessage" | "SMS" | undefined {
    if (!chatGuid) return undefined;
    const prefix = chatGuid.split(";")[0]?.toLowerCase();
    if (prefix === "imessage") return "iMessage";
    if (prefix === "sms") return "SMS";
    return undefined;
}

export async function createChatWithMessage(options: {
    http: HttpClient;
    address: string;
    message: string;
    tempGuid?: string;
    subject?: string;
    effectId?: string;
    service?: "iMessage" | "SMS";
}): Promise<string> {
    const { http, address, message, tempGuid, subject, effectId, service } = options;
    try {
        const response = await http.post("/api/v1/chat/new", {
            addresses: [address],
            message,
            tempGuid,
            subject,
            effectId,
            ...(service && { service }),
        });
        return response.data.data?.guid;
    } catch (error) {
        throw new Error(
            `Failed to create chat with address "${address}": ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }
}
