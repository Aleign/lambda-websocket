/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Connection = void 0;
/**
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        ::
*/
const dayjs_1 = __importDefault(require("dayjs"));
const schema = {
    connectionId: { type: String, required: true, hasKey: true },
    request: { type: String, required: true },
    data: { type: String },
    ttl: { type: Number, default: () => (0, dayjs_1.default)().add(2, 'hours').unix() }
};
const options = {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'lastPing'
    }
};
exports.Connection = {
    tableName: 'Websocket-Connections',
    name: 'Connection',
    schema,
    options
};
