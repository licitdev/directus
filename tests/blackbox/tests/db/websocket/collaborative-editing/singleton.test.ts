// Collaborative Editing Singleton Test
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
import { sleep } from '@utils/sleep';
import getPort from 'get-port';
import knex, { Knex } from 'knex';
import { cloneDeep } from 'lodash-es';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collectionCollabSingleton } from './singleton.seed';

const ROLE_NAME = 'Test Collab Singleton Role';

describe('Collaborative Editing: Singleton', () => {
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

	describe('Singleton Access (Item Rules)', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			let roleId: string | undefined;
			let userId: string | undefined;

			try {
				// Setup
				await request(TEST_URL)
					.patch(`/items/${collectionCollabSingleton}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.send({ title: 'Singleton Item', is_published: true });

				roleId = await CreateRole(vendor, { name: ROLE_NAME });
				userId = await CreateUser(vendor, { role: roleId!, token: userToken, email: `${userToken}@example.com` });

				await CreatePermission(vendor, {
					role: roleId as any,
					permissions: [
						{
							collection: collectionCollabSingleton,
							action: 'read',
							permissions: { title: { _neq: 'Hidden' } },
							fields: ['*'],
						},
						{
							collection: collectionCollabSingleton,
							action: 'update',
							permissions: { title: { _neq: 'Hidden' } },
							fields: ['title'],
						},
					],
				});

				const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
				const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

				await Promise.all([ws1.waitForState(ws1.conn.OPEN), ws2.waitForState(ws2.conn.OPEN)]);

				// Action
				await ws1.sendMessage({
					type: 'collab',
					action: 'join',
					collection: collectionCollabSingleton,
					item: null,
					version: null,
				});

				const init1 = await ws1.getMessages(1);
				const room = init1![0]!['room'];

				await ws2.sendMessage({
					type: 'collab',
					action: 'join',
					collection: collectionCollabSingleton,
					item: null,
					version: null,
				});

				await ws2.getMessages(1); // Drain INIT
				await ws1.getMessages(1); // Drain JOIN

				// Action
				await ws1.sendMessage({ type: 'collab', action: 'focus', room, field: 'title' });

				await sleep(100);

				await ws1.sendMessage({
					type: 'collab',
					action: 'update',
					room,
					field: 'title',
					changes: 'Updated By Admin',
				});

				// Assert
				const messages: any[] = [];
				const startMs = Date.now();

				while (Date.now() - startMs < 5000) {
					const count = ws2.getUnreadMessageCount();

					if (count > 0) {
						const newMessages = (await ws2.getMessages(count)) || [];
						messages.push(...newMessages);

						if (
							messages.some((msg: any) => msg.type === 'collab' && msg.action === 'update' && msg.field === 'title')
						) {
							break;
						}
					}

					await sleep(100);
				}

				const updateMsg = messages.find(
					(msg: any) => msg.type === 'collab' && msg.action === 'update' && msg.field === 'title',
				);

				if (!updateMsg) {
					throw new Error(`Expected update message not found. Got ${messages.length} messages.`);
				}

				expect(updateMsg).toMatchObject({
					type: 'collab',
					action: 'update',
					room,
					field: 'title',
					changes: 'Updated By Admin',
				});

				ws1.conn.close();
				ws2.conn.close();
			} finally {
				// Cleanup
				try {
					if (userId)
						await request(TEST_URL).delete(`/users/${userId}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);
					if (roleId)
						await request(TEST_URL).delete(`/roles/${roleId}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);
				} catch {
					// Cleanup failed
				}
			}
		});
	});

	describe('Reactive Invalidation (Singleton)', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			let roleId: string | undefined;
			let userId: string | undefined;

			try {
				// Setup
				await request(TEST_URL)
					.patch(`/items/${collectionCollabSingleton}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.send({ title: 'Singleton External Test', is_published: true });

				roleId = await CreateRole(vendor, { name: `${ROLE_NAME}-external` });
				userId = await CreateUser(vendor, { role: roleId!, token: userToken, email: `${userToken}@example.com` });

				await CreatePermission(vendor, {
					role: roleId as any,
					permissions: [
						{
							collection: collectionCollabSingleton,
							action: 'read',
							fields: ['*'],
						},
					],
				});

				const ws = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

				await ws.waitForState(ws.conn.OPEN);

				// Action
				await ws.sendMessage({
					type: 'collab',
					action: 'join',
					collection: collectionCollabSingleton,
					item: null,
					version: null,
				});

				const init = await ws.getMessages(1); // Drain INIT
				const room = init![0]!['room'];

				// Action
				await request(TEST_URL)
					.patch(`/items/${collectionCollabSingleton}`)
					.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`)
					.send({ title: 'Updated Externally' });

				// Assert
				const saveMsg = await ws.getMessages(1);

				expect(saveMsg![0]).toMatchObject({
					type: 'collab',
					action: 'save',
					room,
				});

				ws.conn.close();
			} finally {
				// Cleanup
				try {
					if (userId)
						await request(TEST_URL).delete(`/users/${userId}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);
					if (roleId)
						await request(TEST_URL).delete(`/roles/${roleId}`).set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);
				} catch {
					// Cleanup failed
				}
			}
		});
	});
});
