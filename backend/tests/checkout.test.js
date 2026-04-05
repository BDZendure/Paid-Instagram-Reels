const request = require('supertest');
const app = require('../src/index');
const db = require('../src/db');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const UUID = 'c3000000-0000-0000-0000-000000000001';

beforeAll(async () => {
  await db.query('DELETE FROM deductions WHERE uuid = $1', [UUID]);
  await db.query('DELETE FROM wallets WHERE id = $1', [UUID]);
  await db.query('INSERT INTO wallets (id, balance_cents) VALUES ($1, 0)', [UUID]);
});

describe('POST /checkout', () => {
  it('returns 400 when uuid is missing', async () => {
    const res = await request(app).post('/checkout').send({ amount_cents: 500 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount_cents is missing', async () => {
    const res = await request(app).post('/checkout').send({ uuid: UUID });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid amount_cents', async () => {
    const res = await request(app).post('/checkout').send({ uuid: UUID, amount_cents: 99 });
    expect(res.status).toBe(400);
  });
});

describe('POST /webhook', () => {
  it('credits wallet on checkout.session.completed', async () => {
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: { uuid: UUID, amount_cents: '500' },
        },
      },
    });

    const sig = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const res = await request(app)
      .post('/webhook')
      .set('stripe-signature', sig)
      .set('Content-Type', 'application/json')
      .send(Buffer.from(payload));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const { rows } = await db.query(
      'SELECT balance_cents FROM wallets WHERE id = $1',
      [UUID]
    );
    expect(rows[0].balance_cents).toBe(500);
  });

  it('returns 400 for invalid signature', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('stripe-signature', 'bad_sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));
    expect(res.status).toBe(400);
  });
});
