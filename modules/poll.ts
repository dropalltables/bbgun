import type { AxiosInstance } from "axios";
import type { AddPollOptionOptions, CreatePollOptions, PollMessageResponse, VotePollOptions } from "../types/poll";

export class PollModule {
    constructor(private readonly http: AxiosInstance) {}

    async create(options: CreatePollOptions): Promise<PollMessageResponse> {
        if (options.options.length < 2) {
            throw new Error("Poll must have at least 2 options");
        }

        const { data } = await this.http.post("/api/v1/poll/create", {
            chatGuid: options.chatGuid,
            title: options.title ?? "",
            options: options.options,
        });

        return data.data;
    }

    async vote(options: VotePollOptions): Promise<PollMessageResponse> {
        const { data } = await this.http.post("/api/v1/poll/vote", {
            chatGuid: options.chatGuid,
            pollMessageGuid: options.pollMessageGuid,
            optionIdentifier: options.optionIdentifier,
        });

        return data.data;
    }

    async unvote(options: VotePollOptions): Promise<PollMessageResponse> {
        const { data } = await this.http.post("/api/v1/poll/unvote", {
            chatGuid: options.chatGuid,
            pollMessageGuid: options.pollMessageGuid,
            optionIdentifier: options.optionIdentifier,
        });

        return data.data;
    }

    async addOption(options: AddPollOptionOptions): Promise<PollMessageResponse> {
        if (!options.optionText || options.optionText.trim().length === 0) {
            throw new Error("Option text cannot be empty");
        }

        const { data } = await this.http.post("/api/v1/poll/option", {
            chatGuid: options.chatGuid,
            pollMessageGuid: options.pollMessageGuid,
            optionText: options.optionText,
        });

        return data.data;
    }
}
