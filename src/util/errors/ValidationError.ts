export class ValidationError extends Error {

  public getField = (): string => {
    return this.field;
  };
  private readonly field: string;
  private readonly code: string;

  constructor(field) {
    super();
    this.name = "ValidationError";
    this.field = field;
    this.message = "Input malformed.";
    this.code = "VALIDATIONERROR";
  }
}