/* Simple example of getting JSON from a POST */
import { App } from '../src/index';

const app = new App({ port: 9001 });

app.post('/*', async req => {
  const body = await req.body('string');
  if (!body) {
    console.log('Invalid or empty body!');
    return;
  }

  console.log(`Posted to %s %j`, req.url, body);

  return body;
});

app.listen(({ host, port }) => {
  console.log(`${port ? 'Listening' : 'Failed listening'} at http://${host}:${port}`);
});
