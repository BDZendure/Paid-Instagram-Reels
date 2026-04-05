const request = require('supertest');
const app = require('../src/index');
const db = require('../src/db');

const UUID = 'b2000000-0000-4000-8000-000000000001';

beforeAll(async () => {
  await db.query('DELETE FROM deductions WHERE uuid = $1', [UUID]);
  await db.query('DELETE FROM wallets WHERE id = $1', [UUID]);
  await db.query('INSERT INTO wallets (id, balance_cents) VALUES ($1, 100)', [UUID]);
});

describe('POST /deduct', () => {
  it('deducts 10 cents for a new slug', async () => {
    const res = await request(app).post('/deduct').send({ uuid: UUID, slug: 'reel-aaa' });
    expect(res.status).toBe(200);
    expect(res.body.balance_cents).toBe(90);
    expect(res.body.blocked).toBe(false);
  });

  it('does not double-charge the same slug', async () => {
    const res = await request(app).post('/deduct').send({ uuid: UUID, slug: 'reel-aaa' });
    expect(res.status).toBe(200);
    expect(res.body.balance_cents).toBe(90);
  });

  it('charges for a different slug', async () => {
    const res = await request(app).post('/deduct').send({ uuid: UUID, slug: 'reel-bbb' });
    expect(res.status).toBe(200);
    expect(res.body.balance_cents).toBe(80);
  });

  it('returns blocked=true when balance reaches 0', async () => {
    for (let i = 0; i < 8; i++) {
      await request(app).post('/deduct').send({ uuid: UUID, slug: `drain-${i}` });
    }
    const res = await request(app).post('/deduct').send({ uuid: UUID, slug: 'last-one' });
    expect(res.body.balance_cents).toBe(0);
    expect(res.body.blocked).toBe(true);
  });

  it('does not go below 0', async () => {
    const res = await request(app).post('/deduct').send({ uuid: UUID, slug: 'overdraft' });
    expect(res.body.balance_cents).toBe(0);
  });

  it('returns 400 when uuid or slug is missing', async () => {
    const r1 = await request(app).post('/deduct').send({ uuid: UUID });
    const r2 = await request(app).post('/deduct').send({ slug: 'x' });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
  });
});
