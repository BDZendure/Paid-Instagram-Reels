const express = require('express');
const router = express.Router();

function webhookHandler(req, res) {
  res.json({ received: true });
}

module.exports = { router, webhookHandler };
