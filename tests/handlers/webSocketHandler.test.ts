import { expect } from 'chai'
import sinon from 'sinon'
import { webSocketHandler } from '../../src/handlers/webSocketHandler'

describe('webSocketHandler', () => {
  const mockSocket = {
    init: sinon.stub(),
    delete: sinon.stub(),
    data: {},
  }

  const mockServer = sinon.stub().resolves({
    onMessage: sinon.stub()
  })

  beforeEach(() => {
    mockSocket.init.resolves()
    mockSocket.delete.resolves()
  })

  afterEach(() => {
    sinon.resetHistory()
  })

  it('handles CONNECT event', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-id',
        eventType: 'CONNECT'
      },
      headers: {}
    }

    const result = await webSocketHandler(mockServer, mockSocket)(event, {})
    expect(result.statusCode).to.equal(200)
    expect(mockSocket.init.calledWith('test-id')).to.be.true
  })

  it('handles MESSAGE event', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-id',
        eventType: 'MESSAGE'
      },
      body: '{"type":"test"}'
    }

    const result = await webSocketHandler(mockServer, mockSocket)(event, {})
    expect(result.statusCode).to.equal(200)
    expect(mockSocket.init.calledWith('test-id')).to.be.true
  })

  it('handles DISCONNECT event', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-id',
        eventType: 'DISCONNECT'
      }
    }

    const result = await webSocketHandler(mockServer, mockSocket)(event, {})
    expect(result.statusCode).to.equal(200)
    expect(mockSocket.delete.calledWith('test-id')).to.be.true
  })

  it('handles errors gracefully', async () => {
    mockSocket.init.rejects(new Error('Test error'))
    
    const event = {
      requestContext: {
        connectionId: 'test-id',
        eventType: 'CONNECT'
      }
    }

    const result = await webSocketHandler(mockServer, mockSocket)(event, {})
    expect(result.statusCode).to.equal(400)
    expect(result.body).to.equal('Test error')
  })
})
