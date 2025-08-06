// cosmos.js
import { CosmosClient } from '@azure/cosmos';
import 'dotenv/config';

const endpoint   = process.env.COSMOS_ENDPOINT;
const key        = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DB || 'secretstore';
const cSecretsId = process.env.COSMOS_CONTAINER_SECRETS || 'secrets';
const cStatsId   = process.env.COSMOS_CONTAINER_STATS   || 'stats';

if (!endpoint || !key) {
  throw new Error('COSMOS_ENDPOINT / COSMOS_KEY missing');
}

const client = new CosmosClient({ endpoint, key });

// DB & Container referenzen (wir gehen davon aus, dass du sie im Portal angelegt hast)
const database       = client.database(databaseId);
const secrets        = database.container(cSecretsId); // TTL im Portal aktiv
const stats          = database.container(cStatsId);   // TTL aus

export { client, database, secrets, stats };
