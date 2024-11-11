interface LambdaSocketOptions {
    ttl?: number;
    models?: {
        Connection: any;
    } | {
        [key: string]: any;
    };
    failOnDelete?: boolean;
    handleProtocols?: (protocols: Set<string>) => string;
    verifyClient?: (info: VerifyClientInfo) => boolean | void;
    onDelete?: (params: {
        connectionId: string;
    }) => Promise<void>;
    debug?: boolean;
}
interface VerifyClientInfo {
    origin: string;
    req: WebSocketRequest;
}
interface WebSocketRequest {
    eventType: string;
    headers: any;
    connectionId: string;
    protocol?: string;
}
interface ConnectionData {
    connectionParams?: Record<string, unknown>;
    body?: unknown;
}
interface WebSocketHeaders {
    upgrade?: string;
    'sec-websocket-version'?: string;
    'sec-websocket-key'?: string;
    'sec-websocket-extensions'?: string;
    'sec-websocket-protocol'?: string;
    [key: string]: string | undefined;
}
export declare class LambdaSocket {
    private _options;
    private _Connection;
    private _socket;
    constructor(options?: LambdaSocketOptions);
    get request(): WebSocketRequest | undefined;
    get connectionId(): string | undefined;
    get data(): ConnectionData;
    get ttl(): number | undefined;
    get lastPing(): number | undefined;
    get protocol(): string | undefined;
    get acknowledged(): boolean;
    get connectionParams(): Record<string, unknown> | undefined;
    filterHeaders(headers?: Record<string, string>): WebSocketHeaders;
    private _handleProtocols;
    private _handleUpgrade;
    init(connectionId: string, request?: WebSocketRequest): Promise<Record<string, string> | undefined>;
    create(connectionId: string, request: WebSocketRequest): Promise<void>;
    auth(data: ConnectionData): Promise<void>;
    pong(): Promise<void>;
    delete(connectionId?: string): Promise<void>;
    send(data: unknown, cb?: () => Promise<void>): Promise<void>;
    close(error?: unknown): Promise<void>;
}
export {};
