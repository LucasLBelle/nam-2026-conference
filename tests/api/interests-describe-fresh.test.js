import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';
import { model } from '../../server/lib/interestsModel.js';

/** The describe route is registered at startup: a first request on a fresh server must not 404. */

let api;
let close;
const real = { ...model };

before(async () => { ({ api, close } = await startApi()); });
after(() => { Object.assign(model, real); return close(); });

test('POST describe works on a fresh server with no earlier PUT', async () => {
  const topic = (await api.json('/bootstrap')).tags.find((t) => t.kind === 'topic').name;
  model.available = () => true;
  model.suggest = async () => [topic];
  const res = await api.post('/users/3/interests/describe', { text: 'anything' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { interests: [topic] });
});
