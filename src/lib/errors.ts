/** Error carrying a message that is safe to show to end users. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "INVALID",
    public readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
