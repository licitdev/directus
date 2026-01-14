import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import config, { type Env, getUrl, paths } from '@common/config';
import { CreatePermission, CreateRole, CreateUser } from '@common/functions';
import vendors, { type Vendor } from '@common/get-dbs-to-test';
import { createWebSocketConn } from '@common/transport';
import { USER } from '@common/variables';
import { awaitDirectusConnection } from '@utils/await-connection';
import getPort from 'get-port';
import knex, { Knex } from 'knex';
import { cloneDeep } from 'lodash-es';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectionCollabMultiInstance } from './multi-instance.seed';

describe('Collaborative Editing: Multi-Instance', () => {
	const databases = new Map<string, Knex>();
	const directusInstances = {} as { [vendor: string]: ChildProcess[] };
	const envs = {} as Record<Vendor, [Env, Env]>;

	const cliPath = existsSync(join(paths.cli, 'run.js'))
		? join(paths.cli, 'run.js')
		: join(paths.cwd, '..', '..', 'api', 'dist', 'cli', 'run.js');

	beforeAll(async () => {
		const promises = [];

		for (const vendor of vendors) {
			databases.set(vendor, knex(config.knexConfig[vendor]!));

			const env1 = cloneDeep(config.envs);
			env1[vendor]['REDIS_HOST'] = '127.0.0.1';
			env1[vendor]['REDIS_PORT'] = '6108';
			env1[vendor]['REDIS_ENABLED'] = 'true';
			env1[vendor]['MESSENGER_STORE'] = 'redis';
			env1[vendor]['SYNCHRONIZATION_STORE'] = 'redis';
			env1[vendor]['WEBSOCKETS_REST_ENABLED'] = 'true';

			const env2 = cloneDeep(env1);

			const p1 = await getPort();
			const p2 = await getPort();

			env1[vendor].PORT = String(p1);
			env2[vendor].PORT = String(p2);

			const s1 = spawn('node', [cliPath, 'start'], { cwd: paths.cwd, env: { ...process.env, ...env1[vendor] } });
			const s2 = spawn('node', [cliPath, 'start'], { cwd: paths.cwd, env: { ...process.env, ...env2[vendor] } });

			directusInstances[vendor] = [s1, s2];
			envs[vendor] = [env1, env2];

			promises.push(awaitDirectusConnection(p1), awaitDirectusConnection(p2));
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

	describe('Cross-instance Propagation (Redis)', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env1 = envs[vendor]![0];
			const env2 = envs[vendor]![1];
			const itemId = randomUUID();

			// Setup
			await request(getUrl(vendor, env1))
				.post(`/items/${collectionCollabMultiInstance}`)
				.send({ id: itemId, title: 'Inter Instance' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(getUrl(vendor, env1), { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(getUrl(vendor, env2), { auth: { access_token: USER.ADMIN.TOKEN } });

			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabMultiInstance,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabMultiInstance,
				item: itemId,
				version: null,
			});

			await ws2.getMessages(1); // Drain INIT
			await ws1.getMessages(1); // Drain JOIN

			// Action
			await ws1.sendMessage({ type: 'collab', action: 'focus', room, field: 'title' });

			await ws2.getMessages(1); // Drain FOCUS

			await ws1.sendMessage({ type: 'collab', action: 'update', room, field: 'title', changes: 'Cross' });

			// Assert
			const updateMsg = await ws2.getMessages(1);
			expect(updateMsg![0]).toMatchObject({ type: 'collab', action: 'update', changes: 'Cross' });

			ws1.conn.close();
			ws2.conn.close();
		});
	});

	describe('Reactive Invalidation (REST Updates)', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'Reactive Role' });

			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [{ collection: collectionCollabMultiInstance, action: 'read', fields: ['*'] }],
			});

			const itemId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabMultiInstance}`)
				.send({ id: itemId, title: 'Original' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			await ws.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabMultiInstance,
				item: itemId,
				version: null,
			});

			const init = await ws.getMessages(1);
			const room = init![0]!['room'];

			// Action
			await request(TEST_URL)
				.patch(`/items/${collectionCollabMultiInstance}/${itemId}`)
				.send({ title: 'New' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			// Assert
			const saveMsg = await ws.getMessages(1);
			expect(saveMsg![0]).toMatchObject({ type: 'collab', action: 'save', room });

			ws.conn.close();
		});
	});
});
