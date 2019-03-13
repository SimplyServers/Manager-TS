export class ServerActionError extends Error {

  private readonly code: string;

  constructor(message) {
    super();
    this.name = "ServerActionError";
    this.message = message;
    this.code = "SERVERERROR";
  }
}
