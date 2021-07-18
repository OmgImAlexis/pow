import ava, { TestInterface } from 'ava';
import fetch, { FetchError } from 'node-fetch';
import { App } from '../src';

declare module "uWebSockets.js" {
    interface HttpResponse {
        /**
         * Has the underlying request been aborted?
         */
        aborted?: boolean;
        /**
         * Has the response been sent?
         */
        done?: boolean;
        /**
         * Has next() been called?
         */
        calledNext?: boolean;
        /**
         * Has res.send() been called yet?
         */
        calledSend?: boolean;
    }
}

const test = ava as TestInterface<{
    app: App
}>;

test.beforeEach(t => {
    // Create the app
    t.context = {
        app: new App({
            host: 'localhost',
            port: 0
        })
    };
});

test.afterEach(t => {
    // Stop the app
    t.context.app.close();
});

test('basic GET request', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('basic POST request', async t => {
    const app = t.context.app;

    // Add POST route
    app.post('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'POST' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('basic DELETE request', async t => {
    const app = t.context.app;

    // Add DELETE route
    app.delete('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'DELETE' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('basic PATCH request', async t => {
    const app = t.context.app;

    // Add PATCH route
    app.patch('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'PATCH' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('basic PUT request', async t => {
    const app = t.context.app;

    // Add PUT route
    app.put('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'PUT' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('basic use request', async t => {
    const app = t.context.app;

    // Add use route
    app.use('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    // GET
    {
        const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
        t.is(response.status, 200);
        t.is(await response.text(), 'Hello World!');
    }

    // POST
    {
        const response = await fetch(`http://localhost:${app.port}/`, { method: 'POST' });
        t.is(response.status, 200);
        t.is(await response.text(), 'Hello World!');
    }

    // DELETE
    {
        const response = await fetch(`http://localhost:${app.port}/`, { method: 'DELETE' });
        t.is(response.status, 200);
        t.is(await response.text(), 'Hello World!');
    }

    // HEAD
    {
        const response = await fetch(`http://localhost:${app.port}/`, { method: 'HEAD' });
        t.is(response.status, 200);
        t.is(await response.text(), '');
    }

    // OPTIONS
    {
        const response = await fetch(`http://localhost:${app.port}/`, { method: 'OPTIONS' });
        t.is(response.status, 200);
        t.is(await response.text(), 'Hello World!');
    }

    // RANDOM_HAT
    // This should fail as it's not a valid HTTP method
    {
        try {
            await fetch(`http://localhost:${app.port}/`, { method: 'RANDOM_HAT' });
        } catch (error: unknown) {
            t.true(error instanceof FetchError);
            t.is((error as FetchError).code, 'ECONNRESET');
            t.true((error as FetchError).message.endsWith('reason: socket hang up'));
        }
    }
});

test('headers', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
    t.deepEqual(Object.fromEntries(response.headers.entries()), {
        'content-length': '12',
        uwebsockets: '19'
    });
});

test('error thrown', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', () => {
        throw new Error('TEST_ERROR');
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 500);
    t.is(await response.text(), '500 TEST_ERROR');
});

test('error thrown with no message', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', () => {
        throw new Error();
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 500);
    t.is(await response.text(), '500 Internal Server Error');
});

test('error thrown with custom status code', async t => {
    const app = t.context.app;

    class CustomError extends Error {
        public status = 401;
    }

    // Add GET route
    app.get('/', () => {
        throw new CustomError('TEST_ERROR');
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 401);
    t.is(await response.text(), '401 TEST_ERROR');
});

test('error returned', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', () => {
        return new Error('TEST_ERROR');
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 500);
    t.is(await response.text(), '500 TEST_ERROR');
});

test('returning a string', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('returning an object', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', () => {
        return {
            test: 'Hello',
            anotherTest: 'World!'
        };
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.deepEqual(await response.json(), {
        test: 'Hello',
        anotherTest: 'World!'
    });
});

test('using res.send()', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', (_, res) => {
        res.send('Hello World!');
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('using return res.send()', async t => {
    const app = t.context.app;

    // Add GET route
    app.get('/', (_, res) => {
        return res.send('Hello World!');
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('using next()', async t => {
    const app = t.context.app;

    // Add route that'll be skipped
    app.get('/', (req, res, next) => {
        next();
    });

    // Add GET route
    app.get('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('returning next()', async t => {
    const app = t.context.app;

    // Add route that'll be skipped
    app.get('/', (req, res, next) => {
        return next();
    });

    // Add GET route
    app.get('/', () => {
        return 'Hello World!';
    });

    // Start app
    app.listen();

    const response = await fetch(`http://localhost:${app.port}/`, { method: 'GET' });
    t.is(response.status, 200);
    t.is(await response.text(), 'Hello World!');
});

test('body parsing echo', async t => {
    const app = t.context.app;

    // Add GET route
    app.post('/', async (req, res, next) => {
        const postBody = await req.body();
        return postBody.toString();
    });

    // Start app
    app.listen();

    const body = JSON.stringify({ test: 123 });
    const response = await fetch(`http://localhost:${app.port}/`, { method: 'POST', body });
    t.is(response.status, 200);
    t.is(await response.text(), body);
});