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
import {
	collectionCollabRelational,
	collectionCollabRelationalA2O,
	collectionCollabRelationalA2OJunction,
	collectionCollabRelationalM2M,
	collectionCollabRelationalM2MJunction,
	collectionCollabRelationalM2O,
	collectionCollabRelationalO2M,
} from './relational.seed';

describe('Collaborative Editing: Relational Permissions', () => {
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

	// ==================== M2O Tests ====================

	describe('M2O Field-Level Permissions', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'M2O Field Restricted' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
					{ collection: collectionCollabRelationalM2O, action: 'read', fields: ['id', 'name', 'field_a'] },
				],
			});

			const m2oId = randomUUID();
			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelationalM2O}`)
				.send({ id: m2oId, name: 'M2O Item', field_a: 'Value A', field_b: 'Value B' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item', m2o_related: m2oId })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'm2o_related' });
			await wsRestricted.getMessages(1);

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'm2o_related',
				changes: { id: m2oId, name: 'Updated M2O', field_a: 'New A', field_b: 'New B' },
			});

			// Assert
			const updateMsg = await wsRestricted.getMessages(1);

			expect(updateMsg![0]).toMatchObject({
				type: 'collab',
				action: 'update',
				field: 'm2o_related',
			});

			const changes = updateMsg![0]!['changes'];

			expect(changes).toHaveProperty('field_a', 'New A');
			expect(changes).not.toHaveProperty('field_b');

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	describe('M2O No Collection Access', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'No M2O Access' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
				],
			});

			const m2oId = randomUUID();
			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelationalM2O}`)
				.send({ id: m2oId, name: 'M2O Item', field_a: 'A', field_b: 'B' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item', m2o_related: m2oId })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'm2o_related' });
			await wsRestricted.getMessages(1);

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'm2o_related',
				changes: { id: m2oId, name: 'Updated', field_a: 'New A', field_b: 'New B' },
			});

			// Assert
			await sleep(500);
			expect(wsRestricted.getUnreadMessageCount()).toBe(0);

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	// ==================== O2M Tests ====================

	describe('O2M Field-Level Permissions (Create)', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'O2M Create Restricted' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
					{ collection: collectionCollabRelationalO2M, action: 'read', fields: ['id', 'name', 'field_a'] },
				],
			});

			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'o2m_related' });
			await wsRestricted.getMessages(1);

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'o2m_related',
				changes: {
					create: [{ id: randomUUID(), name: 'O2M Item', field_a: 'Value A', field_b: 'Value B' }],
					update: [],
					delete: [],
				},
			});

			// Assert
			const updateMsg = await wsRestricted.getMessages(1);

			expect(updateMsg![0]).toMatchObject({
				type: 'collab',
				action: 'update',
				field: 'o2m_related',
			});

			const changes = updateMsg![0]!['changes'];

			expect(changes?.create?.[0]).toHaveProperty('field_a', 'Value A');
			expect(changes?.create?.[0]).not.toHaveProperty('field_b');

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	describe('O2M Field-Level Permissions (Update)', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'O2M Update Restricted' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
					{ collection: collectionCollabRelationalO2M, action: 'read', fields: ['id', 'name', 'field_a'] },
				],
			});

			const mainId = randomUUID();
			const o2mId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelationalO2M}`)
				.send({ id: o2mId, name: 'O2M Item', field_a: 'Old A', field_b: 'Old B' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item', o2m_related: [o2mId] })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'o2m_related' });
			await wsRestricted.getMessages(1);

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'o2m_related',
				changes: {
					create: [],
					update: [{ id: o2mId, field_a: 'New A', field_b: 'New B' }],
					delete: [],
				},
			});

			// Assert
			const updateMsg = await wsRestricted.getMessages(1);

			expect(updateMsg![0]).toMatchObject({
				type: 'collab',
				action: 'update',
				field: 'o2m_related',
			});

			const changes = updateMsg![0]!['changes'];

			expect(changes?.update?.[0]).toHaveProperty('field_a', 'New A');
			expect(changes?.update?.[0]).not.toHaveProperty('field_b');

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	describe('O2M No Collection Access', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'No O2M Access' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
				],
			});

			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'o2m_related' });
			await wsRestricted.getMessages(1);

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'o2m_related',
				changes: {
					create: [{ id: randomUUID(), name: 'O2M Item', field_a: 'A', field_b: 'B' }],
					update: [],
					delete: [],
				},
			});

			// Assert
			await sleep(500);
			const unreadCount = wsRestricted.getUnreadMessageCount();

			if (unreadCount > 0) {
				const updateMsg = await wsRestricted.getMessages(1);
				const changes = updateMsg![0]?.['changes'];

				if (changes) {
					expect(changes.create || []).toHaveLength(0);
				}
			}

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	// ==================== M2M Tests ====================

	describe('M2M Field-Level Permissions', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'M2M Field Restricted' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
					{ collection: collectionCollabRelationalM2MJunction, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelationalM2M, action: 'read', fields: ['id', 'name', 'field_a'] },
				],
			});

			const m2mId = randomUUID();
			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelationalM2M}`)
				.send({ id: m2mId, name: 'M2M Item', field_a: 'Value A', field_b: 'Value B' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'm2m_related' });
			await wsRestricted.getMessages(1);

			// M2M uses junction table format
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'm2m_related',
				changes: {
					create: [
						{
							[`${collectionCollabRelationalM2M}_id`]: {
								id: m2mId,
								name: 'M2M Item',
								field_a: 'Value A',
								field_b: 'Value B',
							},
						},
					],
					update: [],
					delete: [],
				},
			});

			// Assert
			const updateMsg = await wsRestricted.getMessages(1);

			expect(updateMsg![0]).toMatchObject({
				type: 'collab',
				action: 'update',
				field: 'm2m_related',
			});

			const changes = updateMsg![0]!['changes'];
			const nestedItem = changes?.create?.[0]?.[`${collectionCollabRelationalM2M}_id`];

			if (nestedItem) {
				expect(nestedItem).toHaveProperty('field_a', 'Value A');
				expect(nestedItem).not.toHaveProperty('field_b');
			}

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	describe('M2M No Collection Access', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'No M2M Access' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
					{ collection: collectionCollabRelationalM2MJunction, action: 'read', fields: ['*'] },
					// No access to M2M target collection
				],
			});

			const m2mId = randomUUID();
			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelationalM2M}`)
				.send({ id: m2mId, name: 'M2M Item', field_a: 'A', field_b: 'B' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'm2m_related' });
			await wsRestricted.getMessages(1);

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'm2m_related',
				changes: {
					create: [
						{
							[`${collectionCollabRelationalM2M}_id`]: {
								id: m2mId,
								name: 'M2M Item',
								field_a: 'A',
								field_b: 'B',
							},
						},
					],
					update: [],
					delete: [],
				},
			});

			// Assert - nested M2M data should be filtered out
			await sleep(500);
			const unreadCount = wsRestricted.getUnreadMessageCount();

			if (unreadCount > 0) {
				const updateMsg = await wsRestricted.getMessages(1);
				const changes = updateMsg![0]?.['changes'];

				if (changes?.create?.[0]) {
					const nestedItem = changes.create[0][`${collectionCollabRelationalM2M}_id`];
					expect(nestedItem).toBeUndefined();
				}
			}

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	// ==================== M2A (A2O) Tests ====================

	describe('M2A Field-Level Permissions', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'M2A Field Restricted' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
					{ collection: collectionCollabRelationalA2OJunction, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelationalA2O, action: 'read', fields: ['id', 'name', 'field_a'] },
				],
			});

			const a2oId = randomUUID();
			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelationalA2O}`)
				.send({ id: a2oId, name: 'A2O Item', field_a: 'Value A', field_b: 'Value B' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'a2o_items' });
			await wsRestricted.getMessages(1);

			// M2A uses junction with collection field
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'a2o_items',
				changes: {
					create: [
						{
							collection: collectionCollabRelationalA2O,
							item: { id: a2oId, name: 'A2O Item', field_a: 'Value A', field_b: 'Value B' },
						},
					],
					update: [],
					delete: [],
				},
			});

			// Assert
			const updateMsg = await wsRestricted.getMessages(1);

			expect(updateMsg![0]).toMatchObject({
				type: 'collab',
				action: 'update',
				field: 'a2o_items',
			});

			const changes = updateMsg![0]!['changes'];
			const nestedItem = changes?.create?.[0]?.item;

			if (nestedItem) {
				expect(nestedItem).toHaveProperty('field_a', 'Value A');
				expect(nestedItem).not.toHaveProperty('field_b');
			}

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});

	describe('M2A No Collection Access', () => {
		it.each(vendors)('%s', async (vendor) => {
			const env = envs[vendor]![0];
			const TEST_URL = getUrl(vendor, env);
			const userToken = `token-${randomUUID()}`;

			// Setup
			const roleId = await CreateRole(vendor, { name: 'No M2A Access' });
			await CreateUser(vendor, { role: roleId, token: userToken, email: `${userToken}@example.com` });

			await CreatePermission(vendor, {
				role: roleId as any,
				permissions: [
					{ collection: collectionCollabRelational, action: 'read', fields: ['*'] },
					{ collection: collectionCollabRelational, action: 'update', fields: ['*'] },
					{ collection: collectionCollabRelationalA2OJunction, action: 'read', fields: ['*'] },
					// No access to A2O target collection
				],
			});

			const a2oId = randomUUID();
			const mainId = randomUUID();

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelationalA2O}`)
				.send({ id: a2oId, name: 'A2O Item', field_a: 'A', field_b: 'B' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			await request(TEST_URL)
				.post(`/items/${collectionCollabRelational}`)
				.send({ id: mainId, name: 'Main Item' })
				.set('Authorization', `Bearer ${USER.ADMIN.TOKEN}`);

			const wsAdmin = createWebSocketConn(TEST_URL, { auth: { access_token: USER.ADMIN.TOKEN } });
			const wsRestricted = createWebSocketConn(TEST_URL, { auth: { access_token: userToken } });

			// Action
			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			const initAdmin = await wsAdmin.getMessages(1);
			const room = initAdmin![0]!['room'];

			await wsRestricted.sendMessage({
				type: 'collab',
				action: 'join',
				collection: collectionCollabRelational,
				item: mainId,
				version: null,
			});

			await wsRestricted.getMessages(1);
			await wsAdmin.getMessages(1);

			await wsAdmin.sendMessage({ type: 'collab', action: 'focus', room, field: 'a2o_items' });
			await wsRestricted.getMessages(1);

			await wsAdmin.sendMessage({
				type: 'collab',
				action: 'update',
				room,
				field: 'a2o_items',
				changes: {
					create: [
						{
							collection: collectionCollabRelationalA2O,
							item: { id: a2oId, name: 'A2O Item', field_a: 'A', field_b: 'B' },
						},
					],
					update: [],
					delete: [],
				},
			});

			// Assert - nested A2O data should be filtered out
			await sleep(500);
			const unreadCount = wsRestricted.getUnreadMessageCount();

			if (unreadCount > 0) {
				const updateMsg = await wsRestricted.getMessages(1);
				const changes = updateMsg![0]?.['changes'];

				if (changes?.create?.[0]) {
					const nestedItem = changes.create[0].item;
					expect(nestedItem).toBeUndefined();
				}
			}

			wsAdmin.conn.close();
			wsRestricted.conn.close();
		});
	});
});
