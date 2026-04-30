'use strict';
require('dotenv').config();

const { ready } = require('./src/db/database');

ready.then(() => {
  const app  = require('./src/app');
  const PORT = parseInt(process.env.PORT || '3001', 10);
  app.listen(PORT, () => {
    console.log(`Five Mins Push Drop API running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
