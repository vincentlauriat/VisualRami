/**
 * Why a request failed. `transport`: no answer reached us (timeout, socket dropped mid-request),
 * so nothing is known about the outcome and the request may be retried. Otherwise the server
 * answered with a verdict ("Session invalide", "Table introuvable"…).
 */
export class RequestError extends Error {
  readonly transport: boolean;
  constructor(message: string, transport: boolean) {
    super(message);
    this.transport = transport;
  }
}

export function isTransportError(err: unknown): boolean {
  return err instanceof RequestError && err.transport;
}

/** Turn a Socket.IO ack (with timeout) into the response, or throw a RequestError. */
export function settle<T>(err: Error | null, response: T | { error: string }): T {
  if (err) throw new RequestError("Le serveur ne répond pas", true);
  if (response && typeof response === "object" && "error" in response) {
    throw new RequestError((response as { error: string }).error, false);
  }
  return response as T;
}
