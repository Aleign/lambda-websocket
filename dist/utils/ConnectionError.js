"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionError = void 0;
class ConnectionError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode || message.statusCode;
    }
}
exports.ConnectionError = ConnectionError;
