export class FileError extends Error {

  public getFile = (): string => {
    return this.file;
  };
  private readonly file: string;
  private readonly code: string;

  constructor(file) {
    super();
    this.name = "FileError";
    this.file = file;
    this.message = "File error.";
    this.code = "FILEERROR";
  }
}
