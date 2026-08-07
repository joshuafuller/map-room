// A request the caller got wrong is a client error whatever its wording.
// Tagging it keeps the HTTP status a property of the failure instead of a
// guess made by matching keywords in the message text.
export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

export const clientError = (message) => new RequestError(message, 400);
