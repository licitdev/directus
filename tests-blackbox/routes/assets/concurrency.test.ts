import { getUrl } from '@common/config';
import request from 'supertest';
import vendors from '@common/get-dbs-to-test';
import { createReadStream, readFileSync } from 'fs';
import path from 'path';
import * as common from '@common/index';
import { v4 as uuid } from 'uuid';
import { sleep } from '@utils/sleep';

const assetsDirectory = [__dirname, '..', '..', 'assets'];
const storages = ['local', 'minio'];
const imageFile = {
	name: 'directus.png',
	type: 'image/png',
	filesize: '7136',
};
const imageFilePath = path.join(...assetsDirectory, imageFile.name);

describe('/assets', () => {
	describe('GET /assets/:id', () => {
		describe('Concurrent file requests', () => {
			describe.each(storages)('Storage: %s', (storage) => {
				it.each(vendors)(
					'%s',
					async (vendor) => {
						// Setup
						const totalRounds = 5;
						const count = 100;
						const secondsTotal = 2;
						const msDelay = 100;
						const timeout = 30000;
						const insertResponse = await request(getUrl(vendor))
							.post('/files')
							.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
							.field('storage', storage)
							.attach('file', createReadStream(imageFilePath));

						// Action
						async function spamRequests() {
							const requests = [];

							for (let duration = 0; duration < secondsTotal * 1000; duration += msDelay) {
								const requestsInner = [];

								for (let i = 0; i < count; i++) {
									requestsInner.push(
										request(getUrl(vendor))
											.get(`/assets/${insertResponse.body.data.id}?cache-buster=${uuid()}`)
											.set('Authorization', `Bearer ${common.USER.ADMIN.TOKEN}`)
											.timeout(timeout)
									);
								}

								requests.push(Promise.all(requestsInner));
								await sleep(msDelay);
							}

							return requests;
						}

						for (let i = 0; i < totalRounds; i++) {
							let responses;

							try {
								responses = await Promise.all(await spamRequests());
							} catch (error) {
								expect(error).toBeUndefined();
								return;
							}

							// Assert
							for (const round of responses) {
								for (const response of round) {
									expect(response.statusCode).toBe(200);
									expect(response.headers['content-type']).toBe(imageFile.type);
									expect(response.headers['content-length']).toBe(imageFile.filesize);
									expect(Buffer.compare(response.body, await readFileSync(imageFilePath))).toBe(0);
								}
							}
						}
					},
					300000
				);
			});
		});
	});
});
