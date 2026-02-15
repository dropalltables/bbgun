import type { MessageResponse } from "./message";

export interface CreatePollOptions {
    chatGuid: string;
    title?: string;
    options: string[];
}

export interface VotePollOptions {
    chatGuid: string;
    pollMessageGuid: string;
    optionIdentifier: string;
}

export interface AddPollOptionOptions {
    chatGuid: string;
    pollMessageGuid: string;
    optionText: string;
}

export interface PollOption {
    optionIdentifier: string;
    text: string;
    attributedText: string;
    creatorHandle: string;
    canBeEdited: boolean;
}

export interface PollVote {
    voteOptionIdentifier: string;
    participantHandle: string;
    serverVoteTime?: number;
}

export interface PollDefinition {
    version: number;
    item: {
        title: string;
        orderedPollOptions: PollOption[];
        creatorHandle: string;
    };
}

export interface PollVoteResponse {
    version: number;
    item: {
        votes: PollVote[];
    };
}

export type PollMessageResponse = MessageResponse;
