export class FileError extends Error{

    private readonly file: string;

    constructor(file){
        super();
        this.name = "FileError";
        this.file = file;
        this.message = "File error.";
    }

    public getFile = (): string => {
        return this.file;
    }
}
