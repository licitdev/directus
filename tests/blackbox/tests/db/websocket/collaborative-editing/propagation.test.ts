import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import config, { type Env, getUrl, paths } from '@common/config';
import vendors, { type Vendor } from '@common/get-dbs-to-test';
import { createWebSocketConn } from '@common/transport';
import { USER } from '@common/variables';
import { awaitDirectusConnection } from '@utils/await-connection';
import getPort from 'get-port';
import knex, { Knex } from 'knex';
import { cloneDeep } from 'lodash-es';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectionCollabPropagation } from './propagation.seed';

describe('Collaborative Editing: Propagation', () => {
	const databases = new Map<string, Knex>();
	const directusInstances = {} as { [vendor: string]: ChildProcess[] };
	const envs = {} as Record<Vendor, [Env]>;

	const cliPath = existsSync(join(paths.cli, 'run.js'))
		? join(paths.cli, 'run.js')
		: join(paths.cwd, '..', '..', 'api', 'dist', 'cli', 'run.js');

	beforeAll(async () => {
		const promises = [];

		for (const vendor of vendors) {
			databases.set(vendor, knex(config.knexConfig[vendor]!));

			const env = cloneDeep(config.envs);
			env[vendor]['REDIS_HOST'] = '127.0.0.1';
			env[vendor]['REDIS_PORT'] = '6108';
			env[vendor]['REDIS_ENABLED'] = 'true';
			env[vendor]['MESSENGER_STORE'] = 'redis';
			env[vendor]['SYNCHRONIZATION_STORE'] = 'redis';
			env[vendor]['WEBSOCKETS_REST_ENABLED'] = 'true';

			const newServerPort = await getPort();
			env[vendor].PORT = String(newServerPort);

			const server = spawn('node', [cliPath, 'start'], { cwd: paths.cwd, env: { ...process.env, ...env[vendor] } });
			directusInstances[vendor] = [server];
			envs[vendor] = [env];

			promises.push(awaitDirectusConnection(newServerPort));
		}

		await Promise.all(promises);
	}, 180_000);

	afterAll(async () => {
		for (const [vendor, connection] of databases) {
			for (const instance of directusInstances[vendor]!) {
				instance.kill();
			}

			await connection.destroy();
		}
	});

	describe('Intra-instance Propagation', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabPropagation}`)
				.send({ id: itemId, title: 'Intra Instance Test' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			// Action
			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabPropagation,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabPropagation,
				item: itemId,
				version: null,
			});

			const init2 = await ws2.getMessages(1);
			expect(init2![0]).toMatchObject({ type: 'collab', action: 'init' });

			await ws1.getMessages(1); // Drain JOIN

			// Action
			await ws1.sendMessage({ type: 'collab', action: 'focus', room, field: 'title' });
			await ws2.getMessages(1); // Drain FOCUS
			await ws1.sendMessage({ type: 'collab', action: 'update', room, field: 'title', changes: 'Updated Title' });

			// Assert
			const updateMsg = await ws2.getMessages(1);

			expect(updateMsg![0]).toMatchObject({
				type: 'collab',
				action: 'update',
				room,
				field: 'title',
				changes: 'Updated Title',
			});

			ws1.conn.close();
			ws2.conn.close();
		});
	});
});
