const express = require('express');
const db = require('../db');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { uuid, slug } = req.body;
    if (!uuid || !slug) return res.status(400).json({ error: 'uuid and slug required' });

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const insert = await client.query(
        'INSERT INTO deductions (uuid, slug) VALUES ($1, $2) ON CONFLICT (uuid, slug) DO NOTHING',
        [uuid, slug]
      );

      if (insert.rowCount > 0) {
        await client.query(
          'UPDATE wallets SET balance_cents = GREATEST(balance_cents - 10, 0) WHERE id = $1',
          [uuid]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows } = await db.query(
      'SELECT balance_cents FROM wallets WHERE id = $1',
      [uuid]
    );
    const balance_cents = rows[0]?.balance_cents ?? 0;
    res.json({ balance_cents, blocked: balance_cents <= 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
