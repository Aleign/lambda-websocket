"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const sinon_1 = __importDefault(require("sinon"));
const webSocketHandler_1 = require("../../src/handlers/webSocketHandler");
describe('webSocketHandler', () => {
    const mockSocket = {
        init: sinon_1.default.stub(),
        delete: sinon_1.default.stub(),
        data: {},
    };
    const mockServer = sinon_1.default.stub().resolves({
        onMessage: sinon_1.default.stub()
    });
    beforeEach(() => {
        mockSocket.init.resolves();
        mockSocket.delete.resolves();
    });
    afterEach(() => {
        sinon_1.default.resetHistory();
    });
    it('handles CONNECT event', async () => {
        const event = {
            requestContext: {
                connectionId: 'test-id',
                eventType: 'CONNECT'
            },
            headers: {}
        };
        const result = await (0, webSocketHandler_1.webSocketHandler)(mockServer, mockSocket)(event, {});
        (0, chai_1.expect)(result.statusCode).to.equal(200);
        (0, chai_1.expect)(mockSocket.init.calledWith('test-id')).to.be.true;
    });
    it('handles MESSAGE event', async () => {
        const event = {
            requestContext: {
                connectionId: 'test-id',
                eventType: 'MESSAGE'
            },
            body: '{"type":"test"}'
        };
        const result = await (0, webSocketHandler_1.webSocketHandler)(mockServer, mockSocket)(event, {});
        (0, chai_1.expect)(result.statusCode).to.equal(200);
        (0, chai_1.expect)(mockSocket.init.calledWith('test-id')).to.be.true;
    });
    it('handles DISCONNECT event', async () => {
        const event = {
            requestContext: {
                connectionId: 'test-id',
                eventType: 'DISCONNECT'
            }
        };
        const result = await (0, webSocketHandler_1.webSocketHandler)(mockServer, mockSocket)(event, {});
        (0, chai_1.expect)(result.statusCode).to.equal(200);
        (0, chai_1.expect)(mockSocket.delete.calledWith('test-id')).to.be.true;
    });
    it('handles errors gracefully', async () => {
        mockSocket.init.rejects(new Error('Test error'));
        const event = {
            requestContext: {
                connectionId: 'test-id',
                eventType: 'CONNECT'
            }
        };
        const result = await (0, webSocketHandler_1.webSocketHandler)(mockServer, mockSocket)(event, {});
        (0, chai_1.expect)(result.statusCode).to.equal(400);
        (0, chai_1.expect)(result.body).to.equal('Test error');
    });
});
