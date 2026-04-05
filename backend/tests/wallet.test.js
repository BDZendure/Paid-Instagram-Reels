const request = require('supertest');
const app = require('../src/index');
const db = require('../src/db');

const UUID_A = 'a1000000-0000-4000-8000-000000000001';
const UUID_B = 'a1000000-0000-4000-8000-000000000002';

beforeAll(async () => {
  await db.query('DELETE FROM deductions WHERE uuid IN ($1, $2)', [UUID_A, UUID_B]);
  await db.query('DELETE FROM wallets WHERE id IN ($1, $2)', [UUID_A, UUID_B]);
});

describe('POST /wallet/init', () => {
  it('creates a wallet and returns balance_cents 0', async () => {
    const res = await request(app).post('/wallet/init').send({ uuid: UUID_A });
    expect(res.status).toBe(200);
    expect(res.body.balance_cents).toBe(0);
  });

  it('is idempotent — does not error on duplicate uuid', async () => {
    const res = await request(app).post('/wallet/init').send({ uuid: UUID_A });
    expect(res.status).toBe(200);
    expect(res.body.balance_cents).toBe(0);
  });

  it('returns 400 when uuid is missing', async () => {
    const res = await request(app).post('/wallet/init').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /wallet/balance', () => {
  beforeAll(async () => {
    await db.query(
      'INSERT INTO wallets (id, balance_cents) VALUES ($1, 350) ON CONFLICT DO NOTHING',
      [UUID_B]
    );
  });

  it('returns the balance for a known uuid', async () => {
    const res = await request(app).get('/wallet/balance').query({ uuid: UUID_B });
    expect(res.status).toBe(200);
    expect(res.body.balance_cents).toBe(350);
  });

  it('returns 400 when uuid query param is missing', async () => {
    const res = await request(app).get('/wallet/balance');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown uuid', async () => {
    const res = await request(app)
      .get('/wallet/balance')
      .query({ uuid: 'a1000000-0000-4000-8000-000000000099' });
    expect(res.status).toBe(404);
  });
});
