import { RequestHandler } from "./request-handler.interface";

/**
 * @interface HttpServer
 * @description Core interface for HTTP server implementation
 * Follows Interface Segregation Principle from SOLID
 */
export interface HttpServer {
    listen(port: number): Promise<void>;
    stop(): Promise<void>;
    get(path: string, handler: RequestHandler): void;
    post(path: string, handler: RequestHandler): void;
    put(path: string, handler: RequestHandler): void;
    delete(path: string, handler: RequestHandler): void;
}