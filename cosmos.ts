// cosmos.ts
import { CosmosClient, type Container, type Database } from "@azure/cosmos";

// ---- sauber getypte Config holen (keine undefineds mehr) --------------------
function getCosmosConfig(): {
  endpoint: string;
  key: string;
  databaseId: string;
  secretsId: string;
  statsId: string;
} {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  if (!endpoint || !key) {
    throw new Error("Cosmos not configured (COSMOS_ENDPOINT/COSMOS_KEY missing)");
  }
  return {
    endpoint,
    key,
    databaseId: process.env.COSMOS_DB || "secretstore",
    secretsId: process.env.COSMOS_CONTAINER_SECRETS || "secrets",
    statsId: process.env.COSMOS_CONTAINER_STATS || "stats",
  };
}

// ---- Caches strikt typisiert ------------------------------------------------
let _client: CosmosClient | null = null;
let _database: Database | null = null;
let _secrets: Container | null = null;
let _stats: Container | null = null;

function getClient(): CosmosClient {
  if (_client) return _client;
  const { endpoint, key } = getCosmosConfig();
  _client = new CosmosClient({
    endpoint,
    key,
    connectionPolicy: { preferredLocations: ["Switzerland North"] },
  });
  return _client;
}

export async function getContainers(): Promise<{ secrets: Container; stats: Container }> {
  if (_secrets && _stats) return { secrets: _secrets, stats: _stats };

  const { databaseId, secretsId, statsId } = getCosmosConfig();
  const client = getClient();

  const { database } = await client.databases.createIfNotExists({ id: databaseId });
  _database = database;

  const { container: secrets } = await database.containers.createIfNotExists({
    id: secretsId,
    partitionKey: { paths: ["/id"] },
    defaultTtl: -1,
  });
  const { container: stats } = await database.containers.createIfNotExists({
    id: statsId,
    partitionKey: { paths: ["/id"] },
    defaultTtl: -1,
  });

  _secrets = secrets;
  _stats = stats;
  return { secrets, stats };
}
