import { EventEmitter } from "node:events";
import axios, { type AxiosInstance } from "axios";
import io from "socket.io-client";
import { getLogger, setGlobalLogLevel, setGlobalLogToFile } from "./lib/Loggable";
import type { LogLevel } from "./lib/Logger";
import {
    AttachmentModule,
    ChatModule,
    ContactModule,
    FaceTimeModule,
    HandleModule,
    ICloudModule,
    MessageModule,
    PollModule,
    ScheduledMessageModule,
    ServerModule,
} from "./modules";
import type { ClientConfig, PhotonEventMap, TypedEventEmitter } from "./types";

export class BBGun extends EventEmitter implements TypedEventEmitter {
    private static getGlobalSdk = (): BBGun | null => (globalThis as any).__BBGun__ ?? null;
    private static setGlobalSdk = (sdk: BBGun) => {
        (globalThis as any).__BBGun__ = sdk;
    };

    public static getInstance(config?: ClientConfig): BBGun {
        const existing = BBGun.getGlobalSdk();
        if (existing) return existing;

        const instance = new BBGun(config);
        BBGun.setGlobalSdk(instance);
        return instance;
    }

    public readonly config: ClientConfig;
    public readonly logger = getLogger("BBGun");
    public readonly http: AxiosInstance;
    public readonly socket: ReturnType<typeof io>;

    public readonly attachments: AttachmentModule;
    public readonly messages: MessageModule;
    public readonly chats: ChatModule;

    public readonly contacts: ContactModule;
    public readonly handles: HandleModule;

    public readonly facetime: FaceTimeModule;
    public readonly icloud: ICloudModule;

    public readonly polls: PollModule;
    public readonly scheduledMessages: ScheduledMessageModule;
    public readonly server: ServerModule;

    private processedMessages = new Set<string>();
    private lastMessageTime = 0;
    private sendQueue: Promise<unknown> = Promise.resolve();
    private readyEmitted = false;
    private listenersAttached = false;

    constructor(config: ClientConfig = {}) {
        super();

        this.config = {
            serverUrl: "http://localhost:1234",
            logLevel: "info",
            logToFile: true,
            ...config,
        };

        if (this.config.logToFile === false) {
            setGlobalLogToFile(false);
        }

        if (this.config.logLevel) {
            setGlobalLogLevel(this.config.logLevel as LogLevel);
        }

        // BlueBubbles authenticates REST requests via a `password` query parameter
        this.http = axios.create({
            baseURL: this.config.serverUrl,
            params: this.config.apiKey ? { password: this.config.apiKey } : undefined,
        });

        // BlueBubbles Socket.IO authenticates with { password } in the handshake
        this.socket = io(this.config.serverUrl, {
            auth: this.config.apiKey ? { password: this.config.apiKey } : undefined,
            transports: ["websocket"],
            timeout: 10000,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: Number.POSITIVE_INFINITY,
            reconnectionDelay: 100,
            reconnectionDelayMax: 2000,
            randomizationFactor: 0.1,
        });

        const enqueueSend = this.enqueueSend.bind(this);

        this.attachments = new AttachmentModule(this.http, enqueueSend);
        this.messages = new MessageModule(this.http, enqueueSend);
        this.chats = new ChatModule(this.http);

        this.contacts = new ContactModule(this.http);
        this.handles = new HandleModule(this.http);

        this.facetime = new FaceTimeModule(this.http);
        this.icloud = new ICloudModule(this.http);

        this.polls = new PollModule(this.http);
        this.scheduledMessages = new ScheduledMessageModule(this.http);
        this.server = new ServerModule(this.http);
    }

    override emit<K extends keyof PhotonEventMap>(
        event: K,
        ...args: PhotonEventMap[K] extends undefined ? [] : [PhotonEventMap[K]]
    ): boolean;
    override emit(event: string | symbol, ...args: unknown[]): boolean {
        return super.emit(event, ...(args as [unknown, ...unknown[]]));
    }

    override on<K extends keyof PhotonEventMap>(
        event: K,
        listener: PhotonEventMap[K] extends undefined ? () => void : (data: PhotonEventMap[K]) => void,
    ): this;
    override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
        return super.on(event, listener as (...args: unknown[]) => void);
    }

    override once<K extends keyof PhotonEventMap>(
        event: K,
        listener: PhotonEventMap[K] extends undefined ? () => void : (data: PhotonEventMap[K]) => void,
    ): this;
    override once(event: string | symbol, listener: (...args: unknown[]) => void): this {
        return super.once(event, listener as (...args: unknown[]) => void);
    }

    override off<K extends keyof PhotonEventMap>(
        event: K,
        listener: PhotonEventMap[K] extends undefined ? () => void : (data: PhotonEventMap[K]) => void,
    ): this;
    override off(event: string | symbol, listener: (...args: unknown[]) => void): this {
        return super.off(event, listener as (...args: unknown[]) => void);
    }

    override addListener<K extends keyof PhotonEventMap>(
        event: K,
        listener: PhotonEventMap[K] extends undefined ? () => void : (data: PhotonEventMap[K]) => void,
    ): this;
    override addListener(event: string | symbol, listener: (...args: unknown[]) => void): this {
        return super.addListener(event, listener as (...args: unknown[]) => void);
    }

    override removeListener<K extends keyof PhotonEventMap>(
        event: K,
        listener: PhotonEventMap[K] extends undefined ? () => void : (data: PhotonEventMap[K]) => void,
    ): this;
    override removeListener(event: string | symbol, listener: (...args: unknown[]) => void): this {
        return super.removeListener(event, listener as (...args: unknown[]) => void);
    }

    async connect() {
        if (!this.listenersAttached) {
            this.listenersAttached = true;
            this.attachSocketListeners();
        }

        if (this.socket.connected) {
            this.logger.info("Already connected to BlueBubbles server");
            return;
        }

        this.socket.connect();
    }

    private attachSocketListeners() {
        const serverEvents: (keyof PhotonEventMap)[] = [
            "new-message",
            "message-updated",
            "updated-message",
            "chat-read-status-changed",
            "group-name-change",
            "participant-added",
            "participant-removed",
            "participant-left",
            "group-icon-changed",
            "group-icon-removed",
            "message-send-error",
            "typing-indicator",
            "new-server",
            "incoming-facetime",
            "ft-call-status-changed",
            "hello-world",
        ];

        for (const eventName of serverEvents) {
            this.socket.on(eventName, (...args: unknown[]) => {
                if (eventName === "new-message" && args.length > 0) {
                    const message = args[0] as { guid?: string; dateCreated?: number };
                    if (message?.guid) {
                        if (this.processedMessages.has(message.guid)) {
                            this.logger.debug(`Message already processed, skipping duplicate: ${message.guid}`);
                            return;
                        }
                        this.processedMessages.add(message.guid);
                        if (message.dateCreated && message.dateCreated > this.lastMessageTime) {
                            this.lastMessageTime = message.dateCreated;
                        }
                    }
                }

                if (args.length > 0) {
                    super.emit(eventName, args[0]);
                } else {
                    super.emit(eventName);
                }
            });
        }

        this.socket.on("disconnect", (reason) => {
            this.logger.info(`Disconnected from BlueBubbles server (reason: ${reason})`);
            this.readyEmitted = false;
            this.emit("disconnect");

            if (reason === "io server disconnect") {
                this.logger.info("Server disconnected, manually triggering reconnect...");
                this.socket.connect();
            }
        });

        this.socket.io.on("reconnect_attempt", (attempt) => {
            this.logger.info(`Reconnection attempt #${attempt}...`);
        });

        this.socket.io.on("reconnect", (attempt) => {
            this.logger.info(`Reconnected successfully after ${attempt} attempt(s)`);
        });

        this.socket.io.on("reconnect_error", (error) => {
            this.logger.warn(`Reconnection error: ${error.message}`);
        });

        this.socket.io.on("reconnect_failed", () => {
            this.logger.error("All reconnection attempts failed");
        });

        this.socket.on("auth-ok", async () => {
            this.logger.info("Authentication successful");
            if (!this.readyEmitted) {
                this.readyEmitted = true;
                await this.recoverMissedMessages();
                this.emit("ready");
            }
        });

        this.socket.on("auth-error", (error: { message: string; reason?: string }) => {
            this.logger.error(`Authentication failed: ${error.message} ${error.reason ? `(${error.reason})` : ""}`);
            this.emit("error", new Error(`Authentication failed: ${error.message}`));
        });

        this.socket.on("connect", async () => {
            this.logger.info("Connected to BlueBubbles server, waiting for authentication...");
            if (!this.config.apiKey) {
                this.logger.info("No password provided, skipping authentication (legacy mode)");
                if (!this.readyEmitted) {
                    this.readyEmitted = true;
                    await this.recoverMissedMessages();
                    this.emit("ready");
                }
            }
        });

        this.socket.on("connect_error", (error) => {
            this.logger.warn(`Connection error: ${error.message}`);
        });
    }

    async close() {
        this.socket.disconnect();
    }

    private async recoverMissedMessages() {
        if (this.lastMessageTime <= 0) return;

        try {
            const after = this.lastMessageTime;
            const messages = await this.messages.getMessages({
                after,
                sort: "ASC",
                limit: 100,
            });

            if (messages.length === 0) {
                this.logger.debug("No missed messages to recover");
                return;
            }

            this.logger.info(`Recovering ${messages.length} missed message(s)`);
            for (const msg of messages) {
                if (msg.guid && !this.processedMessages.has(msg.guid)) {
                    this.processedMessages.add(msg.guid);
                    if (msg.dateCreated && msg.dateCreated > this.lastMessageTime) {
                        this.lastMessageTime = msg.dateCreated;
                    }
                    super.emit("new-message", msg);
                }
            }
        } catch (e) {
            this.logger.warn(`Failed to recover missed messages: ${e}`);
        }
    }

    public clearProcessedMessages(maxSize: number = 1000) {
        if (this.processedMessages.size > maxSize) {
            const messages = Array.from(this.processedMessages);
            this.processedMessages.clear();
            messages.slice(-Math.floor(maxSize / 2)).forEach((guid) => {
                this.processedMessages.add(guid);
            });
            this.logger.debug(`Cleared processed message records, retained ${this.processedMessages.size} messages`);
        }
    }

    public getProcessedMessageCount(): number {
        return this.processedMessages.size;
    }

    public enqueueSend<T>(task: () => Promise<T>): Promise<T> {
        const result = this.sendQueue.then(() => task());
        this.sendQueue = result.catch(() => {});
        return result;
    }
}

export const SDK = BBGun.getInstance;
