require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Webhook must receive raw body for Stripe signature verification.
// Register this route BEFORE express.json() so the body is not parsed.
const { webhookHandler } = require('./routes/checkout');
app.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(cors());
app.use(express.json());

app.use('/wallet', require('./routes/wallet'));
app.use('/deduct', require('./routes/deduct'));
app.use('/checkout', require('./routes/checkout').router);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on :${PORT}`));
}

module.exports = app;
