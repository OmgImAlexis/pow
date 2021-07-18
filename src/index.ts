import uWS from 'uWebSockets.js';
import { parse as parseQueryString } from 'querystring';
import contentTypeParser from 'content-type-parser';

interface Options {
    host?: string;
    port?: number;
}

export interface Request {
    query: Record<string, unknown>;
    headers: Record<string, unknown>;
    body: () => ReturnType<App['parse']>;
    url: string;
}
export interface Response {
    send(body: string | object): void;
}

export type NextFunction = () => void;

export type RouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown> | unknown;

const isJSON = (obj: unknown): obj is JSON => {
    try {
        JSON.stringify(obj);
        return true;
    } catch {
        return false;
    }
};

class HTTPError extends Error {
    constructor(public readonly code: number, message?: string) {
        super(message);
    }
}

export class App {
    public readonly host: string;
    #app: uWS.TemplatedApp;
    #port: number;
    #socket?: uWS.us_listen_socket;

    constructor(options: Options) {
        this.host = options.host === 'localhost' ? '127.0.0.1' : (options.host ?? '0.0.0.0');
        this.#port = options.port ?? 0;

        this.#app = uWS.App();
    }

    public get port() {
        return this.#port;
    }

    public use(path: string, handler: RouteHandler) {
        return this.handle('any', path, handler);
    }

    public get(path: string, handler: RouteHandler) {
        return this.handle('get', path, handler);
    }

    public post(path: string, handler: RouteHandler) {
        return this.handle('post', path, handler);
    }

    public put(path: string, handler: RouteHandler) {
        return this.handle('put', path, handler);
    }

    public patch(path: string, handler: RouteHandler) {
        return this.handle('patch', path, handler);
    }

    public delete(path: string, handler: RouteHandler) {
        return this.handle('del', path, handler);
    }

    public options(path: string, handler: RouteHandler) {
        return this.handle('options', path, handler);
    }

    public connect(path: string, handler: RouteHandler) {
        return this.handle('connect', path, handler);
    }

    public head(path: string, handler: RouteHandler) {
        return this.handle('head', path, handler);
    }

    public listen(done?: (options: { host: string; port: number; }) => void) {
        this.#app.listen(this.host, this.port, socket => {
            // Save this socket for graceful closing
            this.#socket = socket;

            // If we passed 0 then resolve the port
            if (this.#port === 0) this.#port = uWS.us_socket_local_port(socket);
            done?.({ host: this.host, port: this.port });
        });
    }

    public close() {
        if (this.#socket) uWS.us_listen_socket_close(this.#socket);
    }

    private handle(method: 'any' | 'get' | 'post' | 'put' | 'patch' | 'del' | 'options' | 'connect' | 'head', path: string, handler: RouteHandler) {
        this.#app[method](path, async (res, req) => {
            res.onAborted(() => {
                res.aborted = true;
            });

            // Build headers object
            const headers: Record<string, any> = {};
            req.forEach((key, value) => {
                headers[key] = value;
            });

            // Get content type
            const contentType = contentTypeParser(headers['content-type']);

            // Parse request body
            const body = () => new Promise<ReturnType<App['parse']>>((resolve, reject) => {
                let buffer: Buffer;
                res.onData((chunk, isLast) => {
                    const curBuf = Buffer.from(chunk);
                    buffer = buffer ? Buffer.concat([buffer, curBuf]) : (isLast ? curBuf : Buffer.concat([curBuf]));
                    if (isLast) {
                        try {
                            const body = this.parse(contentType, buffer);
                            return resolve(body);
                        } catch (error) {
                            reject(error);
                        }
                    }
                });
            });

            const request = {
                query: parseQueryString(req.getQuery()),
                headers,
                body,
                url: req.getUrl()
            };
            const response = {
                send(body: string | object) {
                    // Bail as the response is already aborted
                    if (res.aborted) return;
                    // Bail as the response has already been sent
                    if (res.done) return;
                    // Bail as this isn't the correct handler for this route
                    if (res.calledNext) return;

                    // Mark send as called
                    res.calledSend = true;

                    // Process string and number
                    if (typeof body === 'string' || typeof body === 'number') {
                        res.cork(() => {
                            // Mark response as done
                            res.done = true;

                            // Send plain text response
                            res.writeStatus('200 OK').end(body);
                        });
                        return;
                    }

                    // Process JSON object
                    if (isJSON(body)) {
                        res.done = true;
                        res.cork(() => {
                            // Mark response as done
                            res.done = true;

                            // Send JSON response
                            res.writeStatus('200 OK').writeHeader('Content-Type', 'application/json').end(JSON.stringify(body));
                        });
                    }
                }
            };
            const next = () => {
                res.calledNext = true;
                req.setYield(true);
            };
            try {
                const body = await Promise.resolve(handler.bind(handler)(request, response, next));

                // Bail as the response has already been sent using res.send
                if (res.calledSend) return;

                // Throw 204 as the body is empty and there was no user thrown error
                if (!body) throw new HTTPError(204, 'No Content');

                // Throw as they returned an error
                if (body instanceof Error) throw body;

                // Send the response
                response.send(body as string | JSON);
            } catch (error) {
                // Bail as the response is already aborted
                if (res.aborted) return;
                // Bail as the response has already been sent
                if (res.done) return;
                // Bail as this isn't the correct handler for this route
                if (res.calledNext) return;

                // Reply with error
                res.done = true;
                res.cork(() => {
                    // Custom HTTP error
                    if (error instanceof HTTPError) {
                        const message = `${error.code} ${error.message}`;
                        res.writeStatus(message).end(message);
                        return;
                    }

                    const status = parseInt(error?.status ?? error?.code ?? '500', 10);
                    const reason = error?.reason || error?.message || (status === 500 ? 'Internal Server Error' : '');
                    const message = `${status}${reason ? (' ' + reason) : ''}`;
                    res.writeStatus(message).end(message);
                });
            }
        });

        // Allow chaining
        return this;
    }

    private parse(contentType: any, buffer: Buffer): void | string | {} | Buffer | PromiseLike<void | string | {} | Buffer> {
        if (contentType === null) throw new Error(`Invalid content-type "${contentType}".`);
        try {
            switch (contentType.type) {
                case 'text':
                    switch (contentType.subtype) {
                        case 'plain':
                            return buffer.toString();
                        case 'html':
                            return buffer.toString();
                        default:
                            break;
                    }
                case 'application':
                    switch (contentType.subtype) {
                        case 'javascript':
                            break;
                        case 'json':
                            return JSON.parse(buffer.toString());
                        case 'xml':
                            break;
                        case 'x-www-form-urlencoded':
                            return parseQueryString(buffer.toString());
                        default:
                            break;
                    }
                case 'multipart':
                    switch (contentType.subtype) {
                        case 'form-data':
                            break;
                        default:
                            break;
                    }
                default:
                    break;
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') console.warn(`Failed parsing body with "${error.message}"`);
            return;
        }

        throw new Error(`Invalid content-type "${contentType.type}/${contentType.subtype}".`);
    }
};
