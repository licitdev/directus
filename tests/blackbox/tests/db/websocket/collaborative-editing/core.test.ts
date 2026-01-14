import { ChildProcess, spawn } from 'child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import config, { type Env, getUrl, paths } from '@common/config';
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
import { collectionCollabCore } from './core.seed';

describe('Collaborative Editing: Core', () => {
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

	describe('Join and leave a room', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'Test Item' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws = createWebSocketConn(TEST_URL, {
				auth: { access_token: USER.ADMIN.TOKEN },
			});

			// Action
			await ws.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			// Assert
			const initMessages = await ws.getMessages(1);

			expect(initMessages![0]).toMatchObject({
				type: 'collab',
				action: 'init',
				collection: collectionCollabCore,
				item: itemId,
			});

			// Action
			await ws.sendMessage({
				type: 'collab',
				action: 'leave',
				room: initMessages![0]!['room'],
			});

			ws.conn.close();
		});
	});

	describe('Join with invalid version returns correct error or sync', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'V1' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws = createWebSocketConn(TEST_URL, {
				auth: { access_token: USER.ADMIN.TOKEN },
			});

			// Action
			await ws.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: 'invalid-version-string',
			});

			// Assert
			const initMessages = await ws.getMessages(1);
			const initMsg = initMessages!.find((m) => m.type === 'collab' && m['action'] === 'init');

			expect(initMsg).toMatchObject({
				collection: collectionCollabCore,
				item: itemId,
				version: 'invalid-version-string',
			});

			ws.conn.close();
		});

		describe('Join with non-existent collection returns error', () => {
			it.each(vendors)('%s', async (vendor) => {
				const env = envs[vendor]![0];
				const TEST_URL = getUrl(vendor, env);

				// Setup
				const ws = createWebSocketConn(TEST_URL, {
					auth: { access_token: USER.ADMIN.TOKEN },
				});

				// Action
				await ws.sendMessage({
					type: 'collab',
					action: 'join',
					collection: 'non_existent_collection',
					item: randomUUID(),
					version: null,
				});

				// Assert
				const errorMsg = await ws.getMessages(1);

				expect(errorMsg![0]).toMatchObject({
					type: 'join',
					status: 'error',
					error: expect.objectContaining({ code: 'INVALID_PAYLOAD' }),
				});

				ws.conn.close();
			});
		});
	});

	describe('Client can rejoin after disconnect and receive latest state', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'V1' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			// Action
			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			await ws2.getMessages(1); // Drain INIT
			await ws1.getMessages(1); // Drain JOIN

			// Action
			ws1.conn.close();

			await sleep(200);

			while (ws2.getUnreadMessageCount() > 0) {
				await ws2.getMessages(1); // Drain LEAVE
			}

			await ws2.sendMessage({ type: 'collab', action: 'focus', room, field: 'title' });

			await ws2.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'title',
				changes: 'V2',
			});

			await sleep(200);

			// Action
			const wsRec = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			await wsRec.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			// Assert
			const init2 = await wsRec.getMessages(1);
			const init2Msg = init2!.find((m) => m.type === 'collab' && m['action'] === 'init');
			expect(init2Msg).toBeDefined();
			expect(init2Msg?.['changes']).toMatchObject({ title: 'V2' });

			wsRec.conn.close();
			ws2.conn.close();
		});
	});

	describe('Disconnect Cleanup', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'Disconnect Test' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			await ws2.getMessages(1); // Drain INIT
			const ws2JoinMsg = await ws1.getMessages(1); // Drain JOIN
			const ws2ConnId = ws2JoinMsg![0]!['connection'];

			// Action
			ws2.conn.close();

			// Assert
			const leaveMsg = await ws1.getMessages(1);

			expect(leaveMsg![0]).toMatchObject({
				type: 'collab',
				action: 'leave',
				room,
				connection: ws2ConnId,
			});

			ws1.conn.close();
		});
	});

	describe('Focus Propagation', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'Focus Test' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			await ws2.getMessages(1); // Drain INIT
			await ws1.getMessages(1); // Drain JOIN

			// Action
			await ws1.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: 'title',
			});

			// Assert
			const focusMsg = await ws2.getMessages(1);

			expect(focusMsg).toContainEqual(
				expect.objectContaining({
					type: 'collab',
					action: 'focus',
					room,
					field: 'title',
					connection: init1![0]!['connection'],
				}),
			);

			ws1.conn.close();
			ws2.conn.close();
		});
	});

	describe('Focus Cleanup', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'Cleanup Focus Test' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			// Action
			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws1.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: 'title',
			});

			await ws1.sendMessage({
				type: 'collab',
				action: 'leave',
				room,
			});

			await sleep(200);

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			// Assert
			const init2 = await ws2.getMessages(1);

			expect(init2![0]).toMatchObject({
				type: 'collab',
				action: 'init',
				focuses: {}, // Verify that the focus from ws1 is gone
			});

			// Action
			await ws2.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: 'title',
			});

			// Assert
			await sleep(200);

			const unreadCount = ws2.getUnreadMessageCount();

			if (unreadCount > 0) {
				const msgs = await ws2.getMessages(unreadCount);
				const error = msgs?.find((m) => m.status === 'error');
				expect(error).toBeUndefined();
			}

			ws1.conn.close();
			ws2.conn.close();
		});
	});

	describe('Atomic Focus Acquisition', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'Race Test' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			await ws2.getMessages(1); // Drain INIT
			await ws1.getMessages(1); // Drain JOIN

			// Action
			const focusPromise1 = ws1.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: 'title',
			});

			const focusPromise2 = ws2.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: 'title',
			});

			await Promise.all([focusPromise1, focusPromise2]);

			await sleep(500);

			// Assert
			const ws1Msgs = [];
			const ws2Msgs = [];

			while (ws1.getUnreadMessageCount() > 0) {
				const msgs = await ws1.getMessages(1);
				if (msgs) ws1Msgs.push(...msgs);
			}

			while (ws2.getUnreadMessageCount() > 0) {
				const msgs = await ws2.getMessages(1);
				if (msgs) ws2Msgs.push(...msgs);
			}

			// Exactly one client should have received an error
			const ws1Errors = ws1Msgs.filter((m) => m.status === 'error');
			const ws2Errors = ws2Msgs.filter((m) => m.status === 'error');

			const totalErrors = ws1Errors.length + ws2Errors.length;
			expect(totalErrors).toBe(1);

			const errorMsg = [...ws1Errors, ...ws2Errors][0];
			expect(errorMsg?.['error']?.message).toContain('already focused');

			ws1.conn.close();
			ws2.conn.close();
		});
	});

	describe('Focus release to allow another client to acquire', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const itemId = randomUUID();

			// Setup
			await request(TEST_URL)
				.post(`/items/${collectionCollabCore}`)
				.send({ id: itemId, title: 'Release Test' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws1 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const ws2 = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });

			// Action
			await ws1.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			const init1 = await ws1.getMessages(1);
			const room = init1![0]!['room'];

			await ws2.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabCore,
				item: itemId,
				version: null,
			});

			await ws2.getMessages(1); // Drain INIT
			await ws1.getMessages(1); // Drain JOIN

			await ws1.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: 'title',
			});

			await ws2.getMessages(1); // Drain FOCUS

			await ws1.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: null,
			});

			await sleep(200);

			// Drain any pending messages
			while (ws2.getUnreadMessageCount() > 0) {
				await ws2.getMessages(1);
			}

			// ws2 should now be able to focus
			await ws2.sendMessage({
				type: 'collab',
				action: 'focus',
				room,
				field: 'title',
			});

			await sleep(200);

			// Assert
			const ws2Msgs = [];

			while (ws2.getUnreadMessageCount() > 0) {
				const msgs = await ws2.getMessages(1);
				if (msgs) ws2Msgs.push(...msgs);
			}

			const errors = ws2Msgs.filter((m) => m.status === 'error');
			expect(errors).toHaveLength(0);

			const ws1FocusMsgs = [];

			while (ws1.getUnreadMessageCount() > 0) {
				const msgs = await ws1.getMessages(1);
				if (msgs) ws1FocusMsgs.push(...msgs);
			}

			const focusNotification = ws1FocusMsgs.find((m) => m['action'] === 'focus' && m['field'] === 'title');
			expect(focusNotification).toBeDefined();

			ws1.conn.close();
			ws2.conn.close();
		});
	});
});
