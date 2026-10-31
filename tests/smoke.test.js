// Run with: DATABASE_URL=postgres://... npm test   (use a throwaway database; it is reset on each run)
process.env.SEED_SAMPLE = 'true';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { pool } = require('../src/db');
const { run } = require('../db/seed');
const app = require('../src/app');

const agent = () => request.agent(app);
const login = async (a, u, p) => a.post('/login').type('form').send({ username: u, password: p });
// smallest valid PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await run();
});
after(() => pool.end());

test('health check reports the database is up', async () => {
  const r = await request(app).get('/api/health');
  assert.equal(r.status, 200); assert.equal(r.body.database, 'up');
});
test('home page lists the seeded cars', async () => {
  const r = await request(app).get('/api/products');
  assert.equal(r.body.length, 19);
});
test('search narrows results by brand text', async () => {
  const r = await request(app).get('/api/products').query({ q: 'porsche' });
  assert.equal(r.body.length, 3);
});
test('price and fuel filters combine', async () => {
  const r = await request(app).get('/api/products').query({ fuel: 'Hybrid', price: '250000-' });
  assert.ok(r.body.length >= 2 && r.body.every(c => c.fuel === 'Hybrid' && c.price_usd >= 250000));
});
test('car detail page shows specs and unknown car gives 404', async () => {
  const ok = await request(app).get('/cars/1');
  assert.equal(ok.status, 200); assert.match(ok.text, /Specifications/);
  assert.equal((await request(app).get('/cars/99999')).status, 404);
});
test('signup rejects a short password and duplicate usernames', async () => {
  const bad = await request(app).post('/signup').type('form').send({ username: 'tester', email: 't@x.com', password: '123' });
  assert.equal(bad.status, 400);
  const ok = await request(app).post('/signup').type('form').send({ username: 'tester', email: 't@x.com', password: 'secret1' });
  assert.equal(ok.status, 302);
  const dup = await request(app).post('/signup').type('form').send({ username: 'TESTER', email: 'other@x.com', password: 'secret1' });
  assert.equal(dup.status, 409);
});
test('login fails with a wrong password and works with the right one', async () => {
  assert.equal((await login(agent(), 'tester', 'wrong')).status, 401);
  assert.equal((await login(agent(), 'tester', 'secret1')).status, 302);
});
test('cart and orders need a login', async () => {
  const r = await request(app).get('/cart');
  assert.equal(r.status, 302); assert.match(r.headers.location, /^\/login/);
});
test('checkout creates an order and lowers stock', async () => {
  const a = agent(); await login(a, 'tester', 'secret1');
  const before = (await request(app).get('/api/products')).body.find(c => c.id === 2).stock;
  await a.post('/cart/add/2'); const co = await a.post('/checkout');
  assert.equal(co.status, 302);
  const after = (await request(app).get('/api/products')).body.find(c => c.id === 2).stock;
  assert.equal(after, before - 1);
  assert.match((await a.get('/orders')).text, /Corvette Stingray/);
});
test('a customer cannot open the admin area', async () => {
  const a = agent(); await login(a, 'tester', 'secret1');
  assert.equal((await a.get('/admin')).status, 403);
});
test('the admin account can log in and open the dashboard', async () => {
  const a = agent(); await login(a, 'admin', '123');
  const r = await a.get('/admin'); assert.equal(r.status, 200); assert.match(r.text, /Active orders/);
});
test('admin can add a car with a photo stored in the database', async () => {
  const a = agent(); await login(a, 'admin', '123');
  const r = await a.post('/admin/products').field({ brand_id: 1, category_id: 1, model: 'Test GT', price_usd: 90000, fuel: 'Gas', stock: 2, body_hex: '#112233', shape: 'coupe' }).attach('images', PNG, { filename: 't.png', contentType: 'image/png' });
  assert.equal(r.status, 302);
  const id = /products\/(\d+)\/edit/.exec(r.headers.location)[1];
  const img = await request(app).get('/cars/' + id + '/image');
  assert.equal(img.headers['content-type'], 'image/png');
});
test('admin can change stock and info, and bad data is rejected', async () => {
  const a = agent(); await login(a, 'admin', '123');
  const bad = await a.post('/admin/products/1').type('form').send({ brand_id: 1, category_id: 1, model: 'X', price_usd: -5, fuel: 'Gas', body_hex: '#000000', shape: 'coupe' });
  assert.equal(bad.status, 400);
  const ok = await a.post('/admin/products/1').type('form').send({ brand_id: 1, category_id: 1, model: '911 Carrera S', price_usd: 150000, stock: 9, fuel: 'Gas', body_hex: '#1F4FD8', shape: 'coupe' });
  assert.equal(ok.status, 302);
  assert.equal((await request(app).get('/api/products')).body.find(c => c.id === 1).stock, 9);
});
test('cancelling an order puts the car back in stock', async () => {
  const a = agent(); await login(a, 'admin', '123');
  const s0 = (await request(app).get('/api/products')).body.find(c => c.model === 'Corvette Stingray').stock;
  const { rows } = await pool.query("SELECT o.id FROM orders o JOIN users u ON u.id=o.user_id WHERE u.username='tester'");
  await a.post('/admin/orders/' + rows[0].id + '/status').type('form').send({ status: 'cancelled' });
  assert.equal((await request(app).get('/api/products')).body.find(c => c.model === 'Corvette Stingray').stock, s0 + 1);
});
