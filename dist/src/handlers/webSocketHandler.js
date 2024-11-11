"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSocketHandler = void 0;
const webSocketHandler = (server, socket) => async (event, context) => {
    const { requestContext: { connectionId, eventType }, headers, body } = event;
    let response = {
        statusCode: 200,
        body: '',
    };
    console.log('EVENT_TYPE', eventType);
    console.log('connectionId', connectionId);
    try {
        switch (eventType) {
            case 'CONNECT':
                response.headers = await socket.init(connectionId, { headers, eventType });
                break;
            case 'MESSAGE':
                await socket.init(connectionId);
                const connectionRequest = socket.data;
                const { onMessage } = await server(event, context);
                if (connectionRequest.connectionParams) {
                    await onMessage(connectionRequest.body);
                }
                await onMessage(body);
                break;
            case 'DISCONNECT':
                await socket.delete(connectionId);
                break;
        }
        return response;
    }
    catch (e) {
        const error = e;
        console.log('graphqlWebSocketHandler error', e);
        //   if (
        //     !isProd &&
        //     code === CloseCode.SubprotocolNotAcceptable &&
        //     socket.protocol === DEPRECATED_GRAPHQL_WS_PROTOCOL
        //   )
        //     console.warn(
        //       `Client provided the unsupported and deprecated subprotocol "${socket.protocol}" used by subscriptions-transport-ws.` +
        //         'Please see https://www.apollographql.com/docs/apollo-server/data/subscriptions/#switching-from-subscriptions-transport-ws.',
        //     );
        //   closed(code, String(reason));
        return {
            statusCode: error?.statusCode || 400,
            body: error?.message
        };
    }
};
exports.webSocketHandler = webSocketHandler;
