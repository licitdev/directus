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
import { collectionCollab, collectionCollabPrivate } from './permissions.seed';

describe('Collaborative Editing: Permissions', () => {
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

	describe('Join Permissions', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'Restricted' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			const itemId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabPrivate}`)
				.send({ id: itemId, secret: 'Hidden' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const ws = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await ws.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabPrivate,
				item: itemId,
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

	describe('Field-level Permissions', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'Field Restricted' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollab, action: 'read', fields: ['id', 'title'] },
					{ collection: collectionCollab, action: 'update', fields: ['id', 'title'] },
				],
			});

			const itemId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollab}`)
				.send({ id: itemId, title: 'Public Title', content: 'Secret Content' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollab,
				item: itemId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollab,
				item: itemId,
				version: null,
			});

			await wsRestricted.getMessages(1); // Drain INIT
			await wsAdmin.getMessages(1); // Drain JOIN

			// Action
			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'title' });

			await wsRestricted.getMessages(1); // Drain FOCUS

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'title',
				changes: 'New Public Title',
			});

			// Assert
			const updateTitle = await wsRestricted.getMessages(1);

			expect(updateTitle![0]).toMatchObject({
				type: 'collab',
				action: 'update',
				field: 'title',
				changes: 'New Public Title',
			});

			// Action
			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'content' });

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'content',
				changes: 'New Secret Content',
			});

			// Assert
			await sleep(500);
			expect(wsRestricted.getUnreadMessageCount()).toBe(0);

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});
});
