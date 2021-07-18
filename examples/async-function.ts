/* SSL/non-SSL example with async/await functions */
import { App } from '../src/index';

async function someAsyncTask() {
  return 'Hey wait for me!';
}

const port = 9001;
const app = new App({ port });

app.get('/*', async () => {
  const response = await someAsyncTask();
  return response;
});

app.listen(({ host, port }) => {
  if (!port) {
    console.error(`Failed listening at http://${host}:${port}`);
    return;
  }

  console.info(`Listening at http://${host}:${port}`);
});