/*jshint node: true */
/*jshint esversion: 6 */
'use strict';
/**
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        ::
*/
import dayjs from 'dayjs'

const schema = {
  connectionId: { type: String, required: true, hasKey: true },
  request: { type: String, required: true },
  data: { type: String },
  ttl: { type: Number, default: () => dayjs().add(2, 'hours').unix() }
}

const options = {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'lastPing'
  }
}

export const Connection = {
  tableName: 'Websocket-Connections',
  name: 'Connection',
  schema,
  options
}
