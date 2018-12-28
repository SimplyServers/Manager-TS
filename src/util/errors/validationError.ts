export class ValidationError extends Error{

    private readonly field: string;

    constructor(field){
        super();
        this.name = "ValidationError";
        this.field = field;
        this.message = "Input malformed.";
    }

    public getField = (): string => {
        return this.field;
    }
}