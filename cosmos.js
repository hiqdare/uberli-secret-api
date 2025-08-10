// cosmos.js
import { CosmosClient } from '@azure/cosmos';
import 'dotenv/config';

const endpoint   = process.env.COSMOS_ENDPOINT;
const key        = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DB || 'secretstore';
const cSecretsId = process.env.COSMOS_CONTAINER_SECRETS || 'secrets';
const cStatsId   = process.env.COSMOS_CONTAINER_STATS   || 'stats';

let _client, _database, _secrets, _stats;

function getClient() {
  if (!_client) {
    if (!endpoint || !key) {
      // NICHT werfen – erst bei DB-Zugriff fehlschlagen, damit /healthz nicht stirbt
      console.error('Cosmos ENV missing (COSMOS_ENDPOINT / COSMOS_KEY)');
    }
    _client = new CosmosClient({ endpoint, key });
  }
  return _client;
}

export async function getContainers() {
  if (_secrets && _stats) return { secrets: _secrets, stats: _stats };

  const client = getClient();
  // Falls ENV fehlt: sauberer Fehler für Aufrufer
  if (!endpoint || !key) throw new Error('Cosmos not configured');

  const { database } = await client.databases.createIfNotExists({ id: databaseId });
  _database = database;

  // WICHTIG: nur beim ersten Mal erstellen; PartitionKey /id (zu deinem Code passend)
  const { container: secrets } = await database.containers.createIfNotExists({
    id: cSecretsId,
    partitionKey: { paths: ['/id'] },
    defaultTtl: -1 // Container-Default TTL: -1 = aus; sonst Sekunden angeben
  });
  const { container: stats } = await database.containers.createIfNotExists({
    id: cStatsId,
    partitionKey: { paths: ['/id'] },
    defaultTtl: -1
  });

  _secrets = secrets;
  _stats   = stats;
  return { secrets, stats };
}
