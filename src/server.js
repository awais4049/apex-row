require('dotenv').config();
const app = require('./app');
const { run } = require('../db/seed');
const port = process.env.PORT || 3000;
run().then(seeded => {
  if (seeded) console.log('Database seeded with starting data.');
  app.listen(port, '0.0.0.0', () => console.log('Apex Row listening on port ' + port));
}).catch(e => { console.error('Could not start. Check the database settings:', e.message); process.exit(1); });
