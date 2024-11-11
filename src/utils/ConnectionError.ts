export class ConnectionError extends Error {

  statusCode: number

  constructor(message, statusCode?) {
   super(message)
   this.statusCode = statusCode || message.statusCode
  }
 }
