/**
 * @interface Request
 * @description Standardized request object independent of HTTP framework
 */
export interface Request {
    path: string;
    method: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    params: Record<string, string>;
    body: unknown;
    originalUrl: string;
}

/**
 * @interface Response
 * @description Standardized response object independent of HTTP framework
 */
export interface Response {
    status(code: number): Response;
    send(body: unknown): void;
    setHeader(name: string, value: string): Response;
}

/**
 * @type RequestHandler
 * @description Type for request handlers following dependency inversion
 */
export type RequestHandler = (req: Request, res: Response) => Promise<void>;
