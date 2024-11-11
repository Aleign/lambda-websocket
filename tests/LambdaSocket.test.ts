import { expect } from 'chai'
import sinon from 'sinon'
import { LambdaSocket } from '../src/LambdaSocket'

describe('LambdaSocket', () => {
  const mockConnection = {
    get: sinon.stub(),
    delete: sinon.stub(),
    save: sinon.stub().resolves(),
  }

  class Connection {
    static get = mockConnection.get
    static delete = mockConnection.delete
  
    connectionId: string = ''
    request: string = ''
    data?: string
    ttl: number = 0
  
    constructor(data: any) {
      Object.assign(this, data)
    }
    save = mockConnection.save
  }

  const mockModels = {
    Connection
  }

  mockModels.Connection.get = mockConnection.get
  mockModels.Connection.delete = mockConnection.delete

  beforeEach(() => {
    mockConnection.get.resolves(null)
    mockConnection.delete.resolves()
    mockConnection.save.resolves()
  })

  afterEach(() => {
    sinon.resetHistory()
  })

  it('initializes with default options', () => {
    const socket = new LambdaSocket({ models: mockModels })
    expect(socket.connectionId).to.be.undefined
    expect(socket.data).to.deep.equal({})
  })

  it('creates new connection successfully', async () => {
    const socket = new LambdaSocket({ models: mockModels })
    const testRequest = {
      eventType: 'CONNECT',
      headers: {
        'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'sec-websocket-version': '13'
      },
      connectionId: 'test-connection-id'
    }
    
    await socket.create('test-connection-id', testRequest)
    expect(mockConnection.save.called).to.be.true
  })

  it('handles connection authentication', async () => {
    const socket = new LambdaSocket({ models: mockModels })
    const testData = {
      connectionParams: { userId: '123' },
      body: { type: 'auth' }
    }
    
    await socket.create('test-connection-id', {
      eventType: 'CONNECT',
      headers: {},
      connectionId: 'test-connection-id'
    })
    
    await socket.auth(testData)
    expect(mockConnection.save.callCount).to.equal(2)
  })

  it('deletes connection correctly', async () => {
    const socket = new LambdaSocket({ models: mockModels })
    await socket.create('test-connection-id', {
      eventType: 'CONNECT',
      headers: {},
      connectionId: 'test-connection-id'
    })
    
    await socket.delete('test-connection-id')
    expect(mockConnection.delete.calledWith('test-connection-id')).to.be.true
  })
})
