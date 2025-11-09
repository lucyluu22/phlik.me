import { RedisClientManager, type ClientManager } from '$lib/models/ClientManager';

import * as db from './db.js';

export const clientManager: ClientManager = new RedisClientManager(await db.connect());
