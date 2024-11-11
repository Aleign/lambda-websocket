"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const sinon_1 = __importDefault(require("sinon"));
const LambdaSocket_1 = require("../src/LambdaSocket");
describe('LambdaSocket', () => {
    const mockConnection = {
        get: sinon_1.default.stub(),
        delete: sinon_1.default.stub(),
        save: sinon_1.default.stub().resolves(),
    };
    class Connection {
        static get = mockConnection.get;
        static delete = mockConnection.delete;
        connectionId = '';
        request = '';
        data;
        ttl = 0;
        constructor(data) {
            Object.assign(this, data);
        }
        save = mockConnection.save;
    }
    const mockModels = {
        Connection
    };
    mockModels.Connection.get = mockConnection.get;
    mockModels.Connection.delete = mockConnection.delete;
    beforeEach(() => {
        mockConnection.get.resolves(null);
        mockConnection.delete.resolves();
        mockConnection.save.resolves();
    });
    afterEach(() => {
        sinon_1.default.resetHistory();
    });
    it('initializes with default options', () => {
        const socket = new LambdaSocket_1.LambdaSocket({ models: mockModels });
        (0, chai_1.expect)(socket.connectionId).to.be.undefined;
        (0, chai_1.expect)(socket.data).to.deep.equal({});
    });
    it('creates new connection successfully', async () => {
        const socket = new LambdaSocket_1.LambdaSocket({ models: mockModels });
        const testRequest = {
            eventType: 'CONNECT',
            headers: {
                'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
                'sec-websocket-version': '13'
            },
            connectionId: 'test-connection-id'
        };
        await socket.create('test-connection-id', testRequest);
        (0, chai_1.expect)(mockConnection.save.called).to.be.true;
    });
    it('handles connection authentication', async () => {
        const socket = new LambdaSocket_1.LambdaSocket({ models: mockModels });
        const testData = {
            connectionParams: { userId: '123' },
            body: { type: 'auth' }
        };
        await socket.create('test-connection-id', {
            eventType: 'CONNECT',
            headers: {},
            connectionId: 'test-connection-id'
        });
        await socket.auth(testData);
        (0, chai_1.expect)(mockConnection.save.callCount).to.equal(2);
    });
    it('deletes connection correctly', async () => {
        const socket = new LambdaSocket_1.LambdaSocket({ models: mockModels });
        await socket.create('test-connection-id', {
            eventType: 'CONNECT',
            headers: {},
            connectionId: 'test-connection-id'
        });
        await socket.delete('test-connection-id');
        (0, chai_1.expect)(mockConnection.delete.calledWith('test-connection-id')).to.be.true;
    });
});
