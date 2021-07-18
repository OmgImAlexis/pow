/* Minimal SSL/non-SSL example */
import { App } from '../src/index';

new App({ port: 9001 }).get('/*', async () => {
  return `Hello World!`;
}).listen(({ host, port }) => {
  console.log(`${port ? 'Listening' : 'Failed listening'} at http://${host}:${port}`);
});