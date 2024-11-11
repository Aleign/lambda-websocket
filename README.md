# @aleign/lambda-websocket

WebSocket handler for AWS Lambda with DynamoDB connection management.

## Installation

```bash
npm install @aleign/lambda-websocket
```

## Usage

### Basic WebSocket Handler

```typescript
import { webSocketHandler, LambdaSocket } from '@aleign/lambda-websocket'

// Create your server handler
const server = (event, context) => {
  return {
    onMessage: async (data) => {
      // Handle incoming messages
      console.log('Received:', data)
    }
  }
}

// Export the handler
export const handler = webSocketHandler(server, new LambdaSocket())
```

### LambdaSocket Configuration

```typescript
const socket = new LambdaSocket({
  ttl: 120, // Connection TTL in minutes
  failOnDelete: true, // Throw errors on delete failures
  debug: true, // Enable debug logging
  onDelete: async ({ connectionId }) => {
    // Custom cleanup on connection delete
  }
})
```

## Environment Variables

- `AWS_REGION`: AWS Region for API Gateway
- `APIG_ENDPOINT`: API Gateway endpoint
- `AWS_ENDPOINT_URL`: Local endpoint URL for development
- `NODE_ENV`: Environment setting (development/production)

## API Reference

### LambdaSocket Methods

- `init(connectionId, request?)`: Initialize connection
- `create(connectionId, request)`: Create new connection
- `auth(data)`: Authenticate connection
- `send(data)`: Send data to client
- `delete(connectionId?)`: Delete connection
- `close(error?)`: Close connection with optional error
- `pong()`: Update connection TTL

### WebSocket Handler Events

- `CONNECT`: Handle new connections
- `MESSAGE`: Process incoming messages
- `DISCONNECT`: Clean up connections

## DynamoDB Schema

Requires a Connection table with:
- `connectionId` (String, Hash Key)
- `request` (String)
- `data` (String, Optional)
- `ttl` (Number)
- `lastPing` (Number, Optional)

## Example

```typescript
// Initialize socket
const socket = new LambdaSocket()

// Handle connection
await socket.init(connectionId, {
  eventType: 'CONNECT',
  headers: event.headers,
  connectionId
})

// Send message
await socket.send({ type: 'message', content: 'Hello!' })

// Close connection
await socket.close()
```

## Custom Connection Models

You can provide your own connection model implementation instead of using the built-in DynamoDB model:

```typescript
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

// Example usage with custom model
const customModels = {
  Connection: MyCustomConnectionModel // implements ConnectionModel interface
}

const socket = new LambdaSocket({
  models: customModels
})
```

This allows integration with any database or storage system by implementing the ConnectionModel interface.

## Protocol Handling

The LambdaSocket supports WebSocket protocol negotiation through the `handleProtocols` option. This is particularly useful when integrating with specific WebSocket protocols like graphql-ws.

```typescript
import { handleProtocols } from 'graphql-ws'

const socket = new LambdaSocket({
  handleProtocols: (protocols: Set<string>) => {
    // handleProtocols from graphql-ws validates and selects
    // the appropriate protocol for GraphQL over WebSocket
    return handleProtocols(protocols)
  }
})
```

This ensures proper protocol selection and compatibility with WebSocket clients. The `handleProtocols` function receives a Set of protocols requested by the client and should return the selected protocol string.
