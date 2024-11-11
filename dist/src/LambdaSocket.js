"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaSocket = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const client_apigatewaymanagementapi_1 = require("@aws-sdk/client-apigatewaymanagementapi");
const utils_1 = require("./utils");
const dynamodb_models_1 = require("@aleign/dynamodb-models");
const models_1 = __importDefault(require("./models"));
const DynamoDB = new dynamodb_models_1.DynamoDBModels(models_1.default);
const APIGatewayClient = new client_apigatewaymanagementapi_1.ApiGatewayManagementApiClient({
    region: process.env.AWS_REGION,
    endpoint: process.env.NODE_ENV === 'development'
        ? process.env.AWS_ENDPOINT_URL
        : `https://${process.env.APIG_ENDPOINT}`
});
class LambdaSocket {
    _options;
    _Connection;
    _socket;
    constructor(options = {}) {
        this._options = {
            ttl: 120,
            models: options.models || DynamoDB.models,
            failOnDelete: true,
            ...options
        };
        this._Connection = this._options.models.Connection;
        this._socket = null;
    }
    get request() {
        if (!this._socket?.request)
            return;
        return JSON.parse(Buffer.from(this._socket.request, 'base64').toString('utf8'));
    }
    get connectionId() {
        return this._socket?.connectionId;
    }
    get data() {
        if (!this._socket?.data)
            return {};
        return JSON.parse(Buffer.from(this._socket.data, 'base64').toString('utf8'));
    }
    get ttl() {
        return this._socket?.ttl;
    }
    get lastPing() {
        return this._socket?.lastPing;
    }
    get protocol() {
        return this.request?.protocol;
    }
    get acknowledged() {
        return Boolean(this._socket?.data?.length);
    }
    get connectionParams() {
        return this.data.connectionParams;
    }
    filterHeaders(headers = {}) {
        if (!headers)
            throw new Error('missing websocket headers from connection');
        return {
            upgrade: 'websocket',
            'sec-websocket-version': headers['sec-websocket-version'] || headers['Sec-WebSocket-Version'],
            'sec-websocket-key': headers['sec-websocket-key'] || headers['Sec-WebSocket-Key'],
            'sec-websocket-extensions': headers['sec-websocket-extensions'] || headers['Sec-WebSocket-Extensions'],
            'sec-websocket-protocol': headers['sec-websocket-protocol'] || headers['Sec-WebSocket-Protocol']
        };
    }
    _handleProtocols(headers) {
        const secWebSocketProtocol = headers['sec-websocket-protocol'];
        const protocols = new Set();
        if (secWebSocketProtocol) {
            try {
                const parsedProtocols = utils_1.subprotocol.parse(secWebSocketProtocol);
                if (Array.isArray(parsedProtocols)) {
                    parsedProtocols.forEach((p) => protocols.add(p));
                }
            }
            catch (e) {
                throw new utils_1.ConnectionError(`Invalid Sec-WebSocket-Protocol header. error: ${e?.message}`, e.code || 400);
            }
        }
        if (protocols.size) {
            return this._options.handleProtocols
                ? this._options.handleProtocols(protocols)
                : protocols.values().next().value;
        }
        return undefined;
    }
    _handleUpgrade(req) {
        if (req.eventType !== 'CONNECT')
            return undefined;
        const headers = this.filterHeaders(req.headers);
        req.headers = headers;
        const key = headers['sec-websocket-key'];
        const version = headers['sec-websocket-version'] ? +headers['sec-websocket-version'] : 0;
        if (headers.upgrade !== 'websocket') {
            throw new utils_1.ConnectionError('Invalid Upgrade header', 400);
        }
        if (!key || !/^[+/0-9A-Za-z]{22}==$/i.test(key)) {
            throw new utils_1.ConnectionError('Missing or invalid Sec-WebSocket-Key header', 400);
        }
        if (version !== 8 && version !== 13) {
            throw new utils_1.ConnectionError('Missing or invalid Sec-WebSocket-Version header', 400);
        }
        req.protocol = this._handleProtocols(headers);
        if (this._options.verifyClient) {
            const info = {
                origin: headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`] || '',
                req
            };
            if (!this._options.verifyClient(info)) {
                throw new utils_1.ConnectionError('Authentication failed', 401);
            }
        }
        return headers['sec-websocket-protocol']
            ? { 'Sec-Websocket-Protocol': headers['sec-websocket-protocol'] }
            : undefined;
    }
    async init(connectionId, request) {
        try {
            this._socket = await this._Connection.get(connectionId);
            if (request?.eventType === 'CONNECT') {
                if (this._socket) {
                    throw new utils_1.ConnectionError('Connection already exists', 403);
                }
                const headers = this._handleUpgrade(request);
                await this.create(connectionId, request);
                return headers;
            }
            if (!this._socket) {
                throw new utils_1.ConnectionError(`connection not found ${connectionId}`, 403);
            }
        }
        catch (e) {
            console.error(e);
            throw new utils_1.ConnectionError(e.message, e.code || 400);
        }
    }
    async create(connectionId, request) {
        try {
            const requestStr = Buffer.from(JSON.stringify(request), 'utf8').toString('base64');
            const connection = new this._Connection({
                connectionId,
                request: requestStr,
                ttl: (0, dayjs_1.default)().add(this._options.ttl, 'minutes').unix()
            });
            await connection.save();
            this._socket = connection;
        }
        catch (e) {
            console.error(e);
            throw new utils_1.ConnectionError(e.message, e.statusCode || 400);
        }
    }
    async auth(data) {
        try {
            if (!this._socket)
                throw new Error('no connection found');
            const dataStr = Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
            this._socket.data = dataStr;
            await this._socket.save();
        }
        catch (e) {
            console.error(e);
            throw new utils_1.ConnectionError(e.message, e.statusCode || 400);
        }
    }
    async pong() {
        if (!this._socket)
            throw new Error('no connection found');
        try {
            this._socket.ttl = (0, dayjs_1.default)().add(2, 'hours').unix();
            await this._socket.save();
        }
        catch (e) {
            console.error(e);
            throw new utils_1.ConnectionError(e.message, e.statusCode || 400);
        }
    }
    async delete(connectionId) {
        connectionId = connectionId || this._socket?.connectionId;
        try {
            if (connectionId) {
                if (typeof this._options.onDelete === 'function') {
                    try {
                        await this._options.onDelete({ connectionId });
                    }
                    catch (e) {
                        if (this._options.failOnDelete)
                            throw e;
                        console.log(e);
                    }
                }
                await this._Connection.delete(connectionId);
                if (this._socket?.connectionId === connectionId) {
                    this._socket = null;
                }
            }
        }
        catch (e) {
            console.error(e);
            throw new utils_1.ConnectionError(e.message, e.statusCode || 400);
        }
    }
    async send(data, cb) {
        if (!this._socket) {
            throw new utils_1.ConnectionError('cannot send, connection not defined', 400);
        }
        if (this._options.debug) {
            console.log('sending to client', this._socket.connectionId, data);
        }
        try {
            if (!data) {
                console.error('data is not defined, skip sending', this._socket.connectionId);
                if (typeof cb === 'function')
                    await cb();
                return;
            }
            const params = {
                ConnectionId: this._socket.connectionId,
                Data: typeof data === 'string' ? data : JSON.stringify(data)
            };
            const command = new client_apigatewaymanagementapi_1.PostToConnectionCommand(params);
            await APIGatewayClient.send(command);
            if (typeof cb === 'function') {
                await cb();
            }
        }
        catch (e) {
            if (e.$metadata?.httpStatusCode === 410) {
                console.log(`Found stale connection, deleting ${this._socket.connectionId}`);
                await this.delete();
            }
            else {
                console.error(e);
                console.log(`Error when sending to ${this._socket.connectionId}: ${e.message}`);
            }
        }
    }
    async close(error) {
        try {
            if (error) {
                await this.send(error);
            }
            await this.delete();
        }
        catch (e) {
            console.error(e);
            throw new utils_1.ConnectionError(e.message, e.statusCode || 400);
        }
    }
}
exports.LambdaSocket = LambdaSocket;
