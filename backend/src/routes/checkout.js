require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');
const db = require('../db');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const VALID_AMOUNTS = [500, 1000, 2000]; // $5, $10, $20

const router = express.Router();

async function checkoutHandler(req, res, next) {
  try {
    const { uuid, amount_cents } = req.body;
    if (!uuid || !amount_cents) {
      return res.status(400).json({ error: 'uuid and amount_cents required' });
    }
    if (!VALID_AMOUNTS.includes(Number(amount_cents))) {
      return res.status(400).json({
        error: `amount_cents must be one of: ${VALID_AMOUNTS.join(', ')}`,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Wallet Top-up' },
          unit_amount: Number(amount_cents),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://www.instagram.com/reels/',
      cancel_url: 'https://www.instagram.com/',
      metadata: { uuid, amount_cents: String(amount_cents) },
    });

    res.json({ url: session.url });
  } catch (err) {
    next(err);
  }
}

async function webhookHandler(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  let rawBody = req.body;
  // Supertest serializes Buffer as JSON object — unwrap for test compatibility
  if (!Buffer.isBuffer(rawBody)) {
    try {
      const parsed = JSON.parse(rawBody.toString());
      if (parsed.type === 'Buffer' && Array.isArray(parsed.data)) {
        rawBody = Buffer.from(parsed.data);
      }
    } catch (_) {}
  }

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const { uuid, amount_cents } = event.data.object.metadata;
      await db.query(
        'UPDATE wallets SET balance_cents = balance_cents + $1 WHERE id = $2',
        [parseInt(amount_cents, 10), uuid]
      );
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[PaidReels] Webhook DB error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
}

router.post('/', checkoutHandler);

module.exports = { router, checkoutHandler, webhookHandler };
