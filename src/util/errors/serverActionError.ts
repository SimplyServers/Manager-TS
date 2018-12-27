export class ServerActionError extends Error{

    constructor(message){
        super();
        this.name = "ServerActionError";
        this.message = message;
    }
}
