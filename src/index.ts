import uWS from 'uWebSockets.js';
import { parse as parseQueryString } from 'querystring';

interface Options {
    host?: string;
    port?: number;
}

export interface Request {
    query: Record<string, unknown>;
    headers: Record<string, unknown>;
}
export interface Response {
    send(body: string | object): void;
}

export type NextFunction = () => void;

export type RouteHandler = (request: Request, response: Response, next: NextFunction) => Promise<unknown> | unknown;

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
        this.handle('any', path, handler);
    }

    public get(path: string, handler: RouteHandler) {
        this.handle('get', path, handler);
    }

    public post(path: string, handler: RouteHandler) {
        this.handle('post', path, handler);
    }

    public put(path: string, handler: RouteHandler) {
        this.handle('put', path, handler);
    }

    public patch(path: string, handler: RouteHandler) {
        this.handle('patch', path, handler);
    }

    public delete(path: string, handler: RouteHandler) {
        this.handle('del', path, handler);
    }

    public options(path: string, handler: RouteHandler) {
        this.handle('options', path, handler);
    }

    public connect(path: string, handler: RouteHandler) {
        this.handle('connect', path, handler);
    }

    public head(path: string, handler: RouteHandler) {
        this.handle('head', path, handler);
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

            const headers: Record<string, any> = {};
            req.forEach((key, value) => {
                headers[key] = value;
            });

            const request = {
                query: parseQueryString(req.getQuery()),
                headers,
            };
            const response = {
                send(body: string | object) {
                    // Bail as the response is already aborted
                    if (res.aborted) return;
                    // Bail as the response has already been sent
                    if (res.done) return;
                    // Bail as this isn't the correct handler for this route
                    if (res.calledNext) return;

                    // Mark send as being used
                    res.calledSend = true;

                    // Process string
                    if (typeof body === 'string') {
                        res.done = true;
                        res.cork(() => {
                            res.writeStatus('200 OK').end(body);
                        });
                        return;
                    }

                    // Process JSON object
                    if (typeof body === 'object') {
                        res.done = true;
                        res.cork(() => {
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

                // Bail as the body is empty
                if (!body) return;

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
                    const status = parseInt(error?.status ?? '500', 10);
                    const reason = error?.reason || error?.message || (status === 500 ? 'Internal Server Error' : '');
                    const message = `${status}${reason ? (' ' + reason) : ''}`;
                    res.writeStatus(message).end(message);
                });
            }
        });
    }
};
