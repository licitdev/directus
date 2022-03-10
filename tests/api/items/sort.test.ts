import config, { getUrl } from '../../config';
import vendors from '../../get-dbs-to-test';
import request from 'supertest';
import knex, { Knex } from 'knex';
import { createArtist, createEvent, createGuest, seedTable, createMany } from '../../setup/utils/factories';
import { internet } from 'faker';

describe('/items', () => {
	const databases = new Map<string, Knex>();

	beforeAll(async () => {
		for (const vendor of vendors) {
			databases.set(vendor, knex(config.knexConfig[vendor]!));
		}
	});

	afterAll(async () => {
		for (const [_vendor, connection] of databases) {
			await connection.destroy();
		}
	});

	describe('/:collection GET', () => {
		describe('returns ascending sort correctly', () => {
			it.each(vendors)('%s', async (vendor) => {
				const name = internet.email();
				let guests: any[] = createMany(createGuest, 10, { name });
				for (let i = 0; i < guests.length; i++) {
					guests[i].shows_attended = i;
				}
				guests = guests.sort(() => Math.random() - 0.5);
				await seedTable(databases.get(vendor)!, 1, 'guests', guests);

				const response = await request(getUrl(vendor))
					.get(`/items/guests?filter={"name": { "_eq": "${name}" }}&sort=shows_attended`)
					.set('Authorization', 'Bearer AdminToken')
					.expect('Content-Type', /application\/json/)
					.expect(200);

				expect(response.body.data.length).toBe(guests.length);
				for (let i = 0; i < guests.length; i++) {
					expect(response.body.data[i].shows_attended).toBe(i);
				}
			});
		});

		describe('returns descending sort correctly', () => {
			it.each(vendors)('%s', async (vendor) => {
				const name = internet.email();
				let guests: any[] = createMany(createGuest, 10, { name });
				for (let i = 0; i < guests.length; i++) {
					guests[i].shows_attended = i;
				}
				guests = guests.sort(() => Math.random() - 0.5);
				await seedTable(databases.get(vendor)!, 1, 'guests', guests);

				const response = await request(getUrl(vendor))
					.get(`/items/guests?filter={"name": { "_eq": "${name}" }}&sort=-shows_attended`)
					.set('Authorization', 'Bearer AdminToken')
					.expect('Content-Type', /application\/json/)
					.expect(200);

				expect(response.body.data.length).toBe(guests.length);
				for (let i = 0; i < guests.length; i++) {
					expect(response.body.data[i].shows_attended).toBe(guests.length - 1 - i);
				}
			});
		});

		describe('returns relational ascending sort correctly', () => {
			it.each(vendors)('%s', async (vendor) => {
				const artist = createArtist();
				let events: any[] = createMany(createEvent, 10);
				for (let i = 0; i < events.length; i++) {
					events[i].cost = i;
				}
				events = events.sort(() => Math.random() - 0.5);
				await seedTable(databases.get(vendor)!, 1, 'artists', artist);
				await seedTable(databases.get(vendor)!, 1, 'events', events);
				const artistsEvents = [];
				for (const event of events) {
					artistsEvents.push({ artists_id: artist.id, events_id: event.id });
				}
				await seedTable(databases.get(vendor)!, 1, 'artists_events', artistsEvents);

				const response = await request(getUrl(vendor))
					.get(
						`/items/artists?filter={"id":{"_eq":"${artist.id}"}}&fields=events.events_id.cost&deep[events][events_id][_sort]=cost`
					)
					.set('Authorization', 'Bearer AdminToken')
					.expect('Content-Type', /application\/json/)
					.expect(200);

				expect(response.body.data.length).toBe(1);
				expect(response.body.data[0].events.length).toBe(events.length);
				for (let i = 0; i < events.length; i++) {
					expect(response.body.data[0].events[i].events_id.cost).toBe(i);
				}
			});
		});
	});
});
