const express = require('express');
const db = require('../db');

const router = express.Router();

router.post('/init', async (req, res, next) => {
  try {
    const { uuid } = req.body;
    if (!uuid) return res.status(400).json({ error: 'uuid required' });

    await db.query(
      'INSERT INTO wallets (id) VALUES ($1) ON CONFLICT DO NOTHING',
      [uuid]
    );
    const { rows } = await db.query(
      'SELECT balance_cents FROM wallets WHERE id = $1',
      [uuid]
    );
    res.json({ balance_cents: rows[0].balance_cents });
  } catch (err) {
    next(err);
  }
});

router.get('/balance', async (req, res, next) => {
  try {
    const { uuid } = req.query;
    if (!uuid) return res.status(400).json({ error: 'uuid required' });

    const { rows } = await db.query(
      'SELECT balance_cents FROM wallets WHERE id = $1',
      [uuid]
    );
    if (!rows.length) return res.status(404).json({ error: 'wallet not found' });
    res.json({ balance_cents: rows[0].balance_cents });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
