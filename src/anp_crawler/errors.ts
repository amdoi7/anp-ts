/**
 * Base error class for all crawler-related failures.
 */
export class AnpCrawlerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnpCrawlerError";
  }
}
