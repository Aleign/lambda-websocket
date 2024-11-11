import dayjs from 'dayjs'
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'
import { subprotocol, ConnectionError } from './utils'
import { DynamoDBModels } from '@aleign/dynamodb-models'
import models from './models'

interface ConnectionModel {
  get(connectionId: string): Promise<Connection>
  delete(connectionId: string): Promise<void>
  new(data: Partial<Connection>): Connection
}

interface Connection {
  connectionId: string
  request: string
  data?: string
  ttl: number
  lastPing?: number
  save(): Promise<void>
}

interface LambdaSocketOptions {
  ttl?: number
  models?: {
    Connection: any
  } | {
    [key: string]: any
  }
  failOnDelete?: boolean
  handleProtocols?: (protocols: Set<string>) => string
  verifyClient?: (info: VerifyClientInfo) => boolean | void
  onDelete?: (params: { connectionId: string }) => Promise<void>
  debug?: boolean
}

interface VerifyClientInfo {
  origin: string
  req: WebSocketRequest
}

interface WebSocketRequest {
  eventType: string
  headers: any
  connectionId: string
  protocol?: string
}

interface ConnectionData {
  connectionParams?: Record<string, unknown>
  body?: unknown
}

interface WebSocketHeaders {
  upgrade?: string
  'sec-websocket-version'?: string
  'sec-websocket-key'?: string
  'sec-websocket-extensions'?: string
  'sec-websocket-protocol'?: string
  [key: string]: string | undefined
}
const DynamoDB = new DynamoDBModels(models)

const APIGatewayClient = new ApiGatewayManagementApiClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.NODE_ENV === 'development' 
    ? process.env.AWS_ENDPOINT_URL 
    : `https://${process.env.APIG_ENDPOINT}`
})

export class LambdaSocket {
  private _options: Required<Pick<LambdaSocketOptions, 'ttl' | 'models' | 'failOnDelete'>> & LambdaSocketOptions
  private _Connection: ConnectionModel
  private _socket: Connection | null

  constructor(options: LambdaSocketOptions = {}) {
    this._options = {
      ttl: 120,
      models: options.models || DynamoDB.models,
      failOnDelete: true,
      ...options
    }
    this._Connection = this._options.models.Connection
    this._socket = null
  }

  get request(): WebSocketRequest | undefined {
    if (!this._socket?.request) return
    return JSON.parse(Buffer.from(this._socket.request, 'base64').toString('utf8'))
  }

  get connectionId(): string | undefined {
    return this._socket?.connectionId
  }

  get data(): ConnectionData {
    if (!this._socket?.data) return {}
    return JSON.parse(Buffer.from(this._socket.data, 'base64').toString('utf8'))
  }

  get ttl(): number | undefined {
    return this._socket?.ttl
  }

  get lastPing(): number | undefined {
    return this._socket?.lastPing
  }

  get protocol(): string | undefined {
    return this.request?.protocol
  }

  get acknowledged(): boolean {
    return Boolean(this._socket?.data?.length)
  }

  get connectionParams(): Record<string, unknown> | undefined {
    return this.data.connectionParams
  }

  filterHeaders(headers: Record<string, string> = {}): WebSocketHeaders {
    if (!headers) throw new Error('missing websocket headers from connection')
    return {
      upgrade: 'websocket',
      'sec-websocket-version': headers['sec-websocket-version'] || headers['Sec-WebSocket-Version'],
      'sec-websocket-key': headers['sec-websocket-key'] || headers['Sec-WebSocket-Key'],
      'sec-websocket-extensions': headers['sec-websocket-extensions'] || headers['Sec-WebSocket-Extensions'],
      'sec-websocket-protocol': headers['sec-websocket-protocol'] || headers['Sec-WebSocket-Protocol']
    }
  }

  private _handleProtocols(headers: WebSocketHeaders): string | undefined {
    const secWebSocketProtocol = headers['sec-websocket-protocol']
    const protocols: Set<string> = new Set()
  
    if (secWebSocketProtocol) {
      try {
        const parsedProtocols = subprotocol.parse(secWebSocketProtocol)
        if (Array.isArray(parsedProtocols)) {
          parsedProtocols.forEach((p: any) => protocols.add(p))
        }
      } catch (e: any) {
        throw new ConnectionError(
          `Invalid Sec-WebSocket-Protocol header. error: ${e?.message}`,
          e.code || 400
        )
      }
    }
  
    if (protocols.size) {
      return this._options.handleProtocols
        ? this._options.handleProtocols(protocols)
        : protocols.values().next().value
    }
    return undefined
  }
  
  private _handleUpgrade(req: WebSocketRequest): Record<string, string> | undefined {
    if (req.eventType !== 'CONNECT') return undefined
  
    const headers = this.filterHeaders(req.headers)
    req.headers = headers
    const key = headers['sec-websocket-key']
    const version = headers['sec-websocket-version'] ? +headers['sec-websocket-version'] : 0
  
    if (headers.upgrade !== 'websocket') {
      throw new ConnectionError('Invalid Upgrade header', 400)
    }
  
    if (!key || !/^[+/0-9A-Za-z]{22}==$/i.test(key)) {
      throw new ConnectionError('Missing or invalid Sec-WebSocket-Key header', 400)
    }
  
    if (version !== 8 && version !== 13) {
      throw new ConnectionError('Missing or invalid Sec-WebSocket-Version header', 400)
    }
  
    req.protocol = this._handleProtocols(headers)
  
    if (this._options.verifyClient) {
      const info = {
        origin: headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`] || '',
        req
      }
  
      if (!this._options.verifyClient(info)) {
        throw new ConnectionError('Authentication failed', 401)
      }
    }
  
    return headers['sec-websocket-protocol'] 
      ? { 'Sec-Websocket-Protocol': headers['sec-websocket-protocol'] }
      : undefined
  }

  async init(connectionId: string, request?: WebSocketRequest): Promise<Record<string, string> | undefined> {
    try {
      this._socket = await this._Connection.get(connectionId)
      
      if (request?.eventType === 'CONNECT') {
        if (this._socket) {
          throw new ConnectionError('Connection already exists', 403)
        }
        const headers = this._handleUpgrade(request)
        await this.create(connectionId, request)
        return headers
      } 
      
      if (!this._socket) {
        throw new ConnectionError(`connection not found ${connectionId}`, 403)
      }
    } catch(e: any) {
      console.error(e)
      throw new ConnectionError(e.message, e.code || 400)
    }
  }

  async create(connectionId: string, request: WebSocketRequest): Promise<void> {
    try {
      const requestStr = Buffer.from(JSON.stringify(request), 'utf8').toString('base64')
      const connection = new this._Connection({
        connectionId,
        request: requestStr,
        ttl: dayjs().add(this._options.ttl, 'minutes').unix()
      })
      await connection.save()
      this._socket = connection
    } catch(e: any) {
      console.error(e)
      throw new ConnectionError(e.message, e.statusCode || 400)
    }
  }

  async auth(data: ConnectionData): Promise<void> {
    try {
      if (!this._socket) throw new Error('no connection found')
      const dataStr = Buffer.from(JSON.stringify(data), 'utf8').toString('base64')
      this._socket.data = dataStr
      await this._socket.save()
    } catch(e: any) {
      console.error(e)
      throw new ConnectionError(e.message, e.statusCode || 400)
    }
  }

  async pong(): Promise<void> {
    if (!this._socket) throw new Error('no connection found')
    try {
      this._socket.ttl = dayjs().add(2, 'hours').unix()
      await this._socket.save()
    } catch(e: any) {
      console.error(e)
      throw new ConnectionError(e.message, e.statusCode || 400)
    }
  }

  async delete(connectionId?: string): Promise<void> {
    connectionId = connectionId || this._socket?.connectionId
    try {
      if (connectionId) {
        if (typeof this._options.onDelete === 'function') {
          try {
            await this._options.onDelete({ connectionId })
          } catch(e) {
            if (this._options.failOnDelete) throw e
            console.log(e)
          }
        }
        await this._Connection.delete(connectionId)
        if (this._socket?.connectionId === connectionId) {
          this._socket = null
        }
      }
    } catch(e: any) {
      console.error(e)
      throw new ConnectionError(e.message, e.statusCode || 400)
    }
  }

  async send(data: unknown, cb?: () => Promise<void>): Promise<void> {
    if (!this._socket) {
      throw new ConnectionError('cannot send, connection not defined', 400)
    }

    if (this._options.debug) {
      console.log('sending to client', this._socket.connectionId, data)
    }

    try {
      if (!data) {
        console.error('data is not defined, skip sending', this._socket.connectionId)
        if (typeof cb === 'function') await cb()
        return
      }

      const params = {
        ConnectionId: this._socket.connectionId,
        Data: typeof data === 'string' ? data : JSON.stringify(data)
      }

      const command = new PostToConnectionCommand(params)
      await APIGatewayClient.send(command)
      
      if (typeof cb === 'function') {
        await cb()
      }
    } catch (e: any) {
      if (e.$metadata?.httpStatusCode === 410) {
        console.log(`Found stale connection, deleting ${this._socket.connectionId}`)
        await this.delete()
      } else {
        console.error(e)
        console.log(`Error when sending to ${this._socket.connectionId}: ${e.message}`)
      }
    }
  }

  async close(error?: unknown): Promise<void> {
    try {
      if (error) {
        await this.send(error)
      }
      await this.delete()
    } catch(e: any) {
      console.error(e)
      throw new ConnectionError(e.message, e.statusCode || 400)
    }
  }
}
