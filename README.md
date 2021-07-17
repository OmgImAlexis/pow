# Pow

A decent HTTP framework.


## Usage

```ts
import { App } from 'pow';

const app = new App({ port: 3000 });

// Add GET route
app.get('/', () => {
    return 'Hello World!';
});

// Start app
app.listen();
```