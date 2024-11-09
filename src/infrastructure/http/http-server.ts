import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type Socket } from 'node:net';
import cluster from 'node:cluster';
import { cpus } from 'node:os';
import { HttpServer } from '../../core/interfaces/http-server.interface';
import { RequestHandler, type Request, type Response } from '../../core/interfaces/request-handler.interface';

/**
 * @class NodeHttpServer
 * @description High-performance HTTP server implementation using Node.js native http module
 * Implements connection pooling, request queuing and graceful shutdown
 */
export class NodeHttpServer implements HttpServer {
    private server: Server;
    private readonly routes: Map<string, RequestHandler>;
    private isShuttingDown: boolean;
    private activeConnections: Set<Socket>;
    private readonly responseCache: Map<string, Buffer>;
    private readonly keepAliveTimeout: number = 5000;
    private readonly maxHeaderSize: number = 8192;
    private readonly requestBufferSize: number = 16384; // 16KB
    private readonly requestPool: Buffer[] = Array(1000).fill(null).map(() => Buffer.allocUnsafe(this.requestBufferSize));
    private poolIndex = 0;
    private readonly routeCache = new Map<string, RequestHandler>();
    private readonly headerCache = new WeakMap<IncomingMessage, Record<string, string>>();
  
    constructor() {
      this.routes = new Map();
      this.isShuttingDown = false;
      this.activeConnections = new Set();
      this.responseCache = new Map();
      
      // Fork workers si c'est le processus principal
      if (cluster.isPrimary) {
        this.setupWorkers();
      }
      
      this.server = this.createServer();
    }

    /**
     * @method setupWorkers
     * @private
     * @description Configure les workers pour le clustering
     */
    private setupWorkers(): void {
        const numCPUs = cpus().length;
    
        // Optimisations V8
        const v8Options = [
            '--max-old-space-size=4096',
            '--optimize-for-size',
            '--max-semi-space-size=64',
            '--initial-heap-size=4096',
        ];
        
        cluster.setupPrimary({
            exec: process.argv[1],
            args: process.argv.slice(2),
            silent: false,
            // @ts-ignore
            v8Options
        });
    
        for (let i = 0; i < numCPUs; i++) {
            const worker = cluster.fork();
            
            // CPU pinning
            if (worker.process.pid) {
                try {
                    // @ts-ignore
                    process.pid = i;
                } catch {}
            }
        }

      cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
      });
    }
  
    /**
     * @method createServer
     * @private
     * @description Creates and configures HTTP server with connection handling
     */
    private createServer(): Server {
      const server = createServer({
        keepAliveTimeout: this.keepAliveTimeout,
        maxHeaderSize: this.maxHeaderSize,
        requestTimeout: 5000,
        // @ts-ignore: Node.js specific
        noDelay: true, // Disable Nagle's algorithm
      }, (req, res) => this.handleRequest(req, res));
  
      // Optimize TCP connections
      server.on('connection', (connection: Socket) => {
        connection.setNoDelay(true); // Disable Nagle's algorithm
        connection.setKeepAlive(true, this.keepAliveTimeout);
        
        this.activeConnections.add(connection);
        connection.once('close', () => {
          this.activeConnections.delete(connection);
        });
      });
  
      return server;
    }
  
    /**
     * @method listen
     * @description Starts HTTP server on specified port with error handling
     */
    public async listen(port: number): Promise<void> {
      if (cluster.isPrimary) {
        console.log('Primary server process started');
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        try {
          this.server.listen(port, () => {
            console.log(`Worker ${process.pid} listening on port ${port}`);
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }
  
    /**
     * @method stop
     * @description Gracefully shuts down server, waiting for active connections
     */
    public async stop(): Promise<void> {
      this.isShuttingDown = true;
      this.server.close();

      const closePromises = Array.from(this.activeConnections).map(conn => 
        new Promise<void>(resolve => {
          conn.end(() => resolve());
        })
      );

      await Promise.all(closePromises);
  
      return new Promise((resolve) => {
        this.server.once('close', () => {
          this.isShuttingDown = false;
          resolve();
        });
      });
    }
  
    /**
     * @method handleRequest
     * @private
     * @description Processes incoming HTTP requests with error handling and routing
     */
    private async handleRequest(
      req: IncomingMessage,
      res: ServerResponse
    ): Promise<void> {
      if (this.isShuttingDown) {
        this.sendStaticResponse(res, 503, 'Server is shutting down');
        return;
      }

      // Use pre-computed route handler
      const routeKey = `${req.method}:${req.url}`;
      const handler = this.routeCache.get(routeKey) || this.routes.get(this.getRouteKey(req.method!, req.url!));
      
      if (!handler) {
        this.sendStaticResponse(res, 404, 'Not Found');
        return;
      }

      // Cache the handler for future requests
      this.routeCache.set(routeKey, handler);

      try {
        const request = await this.parseRequestFast(req);
        await handler(request, this.createResponse(res, routeKey));
      } catch (error) {
        this.sendStaticResponse(res, 500, 'Internal Server Error');
      }
    }
  
    private sendStaticResponse(res: ServerResponse, status: number, message: string): void {
      const buffer = Buffer.from(message);
      res.writeHead(status, { 
        'Content-Length': buffer.length,
        'Connection': 'keep-alive'
      });
      res.end(buffer);
    }
  
    /**
     * @method parseRequestFast
     * @private
     * @description Parses incoming HTTP request into standardized format
     */
    private async parseRequestFast(req: IncomingMessage): Promise<Request> {
      // Reuse cached headers
      let headers = this.headerCache.get(req);
      if (!headers) {
        headers = req.headers as Record<string, string>;
        this.headerCache.set(req, headers);
      }

      // Skip body parsing for GET/HEAD
      const body = (req.method === 'GET' || req.method === 'HEAD')
        ? {}
        : await this.parseBodyFast(req);

      // Fast path for URLs without query params
      const url = req.url!;
      const queryIndex = url.indexOf('?');
      if (queryIndex === -1) {
        return {
          path: url,
          method: req.method!,
          headers,
          query: {},
          params: {},
          body,
          originalUrl: url
        };
      }

      return {
        path: url.slice(0, queryIndex),
        method: req.method!,
        headers,
        query: this.parseQueryStringFast(url.slice(queryIndex + 1)),
        params: {},
        body,
        originalUrl: url
      };
    }
  
    /**
     * @method parseBodyFast
     * @private
     * @description Optimized body parsing with pre-allocated buffers
     */
    private parseBodyFast(req: IncomingMessage): Promise<unknown> {
      return new Promise((resolve) => {
        // Get buffer from pool
        const buffer = this.requestPool[this.poolIndex];
        this.poolIndex = (this.poolIndex + 1) % this.requestPool.length;
        
        let offset = 0;
        
        req.on('data', chunk => {
          const remaining = this.requestBufferSize - offset;
          if (remaining <= 0) {
            req.destroy();
            resolve({});
            return;
          }

          const copied = chunk.copy(buffer, offset, 0, Math.min(chunk.length, remaining));
          offset += copied;
        });
        
        req.on('end', () => {
          if (offset === 0) {
            resolve({});
            return;
          }

          try {
            const body = buffer.slice(0, offset).toString();
            resolve(JSON.parse(body));
          } catch {
            resolve({});
          }
        });
        
        req.on('error', () => resolve({}));
      });
    }
  
    /**
     * @method parseQueryStringFast
     * @private
     * @description Optimized query string parsing
     */
    private parseQueryStringFast(query: string): Record<string, string> {
      const result: Record<string, string> = {};
      let start = 0;
      let index = 0;
      
      while (index < query.length) {
        // Find key-value separator
        while (index < query.length && query[index] !== '=' && query[index] !== '&') index++;
        
        const key = query.slice(start, index);
        if (!key) {
          index++;
          start = index;
          continue;
        }

        let value = '';
        if (query[index] === '=') {
          start = ++index;
          while (index < query.length && query[index] !== '&') index++;
          value = query.slice(start, index);
        }

        try {
          result[decodeURIComponent(key)] = decodeURIComponent(value);
        } catch {}
        
        index++;
        start = index;
      }
      
      return result;
    }
  
    /**
     * @method createResponse
     * @private
     * @description Creates optimized response object with caching
     */
    private createResponse(res: ServerResponse, cacheKey: string): Response {
      return {
        status(code: number) {
          res.statusCode = code;
          return this;
        },
        send: (body: unknown) => {
          const responseBuffer = Buffer.from(JSON.stringify(body));
          
          if (res.statusCode === 200) {
            this.responseCache.set(cacheKey, responseBuffer);
          }

          res.writeHead(res.statusCode, {
            'Content-Type': 'application/json',
            'Content-Length': responseBuffer.length,
            'Connection': 'keep-alive',
            'Keep-Alive': `timeout=${this.keepAliveTimeout}`
          });
          
          res.end(responseBuffer);
        },
        setHeader(name: string, value: string) {
          res.setHeader(name, value);
          return this;
        }
      };
    }
  
    public get(path: string, handler: RequestHandler): void {
      this.routes.set(this.getRouteKey('GET', path), handler);
    }
  
    public post(path: string, handler: RequestHandler): void {
      this.routes.set(this.getRouteKey('POST', path), handler);
    }
  
    public put(path: string, handler: RequestHandler): void {
      this.routes.set(this.getRouteKey('PUT', path), handler);
    }
  
    public delete(path: string, handler: RequestHandler): void {
      this.routes.set(this.getRouteKey('DELETE', path), handler);
    }
  
    private getRouteKey(method: string, path: string): string {
      return `${method}:${path}`;
    }
}