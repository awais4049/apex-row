const fs = require('fs'), path = require('path'), bcrypt = require('bcryptjs');
const { pool, query, tx } = require('../src/db');

const BRANDS = [['Porsche','Germany',1931,'porsche.com'],['Chevrolet','United States',1911,'chevrolet.com'],['Ferrari','Italy',1947,'ferrari.com'],['Lamborghini','Italy',1963,'lamborghini.com'],['McLaren','United Kingdom',1963,'mclaren.com'],['Aston Martin','United Kingdom',1913,'astonmartin.com'],['Mercedes-AMG','Germany',1967,'mercedes-amg.com'],['Nissan','Japan',1933,'nissanusa.com'],['Ford','United States',1903,'ford.com'],['BMW','Germany',1916,'bmw.com'],['Toyota','Japan',1937,'toyota.com']];
const CATS = [['Coupe','Two-door car with a fixed roof'],['Mid-engine','Engine sits behind the driver'],['Convertible','Open-top car'],['Grand tourer','Fast and comfortable over long distances'],['Electric','Battery-electric drivetrain']];
const COLORS = [['Rosso','#C8102E'],['Signal yellow','#F2B705'],['Marine blue','#1F4FD8'],['Silverstone','#AEB4BB'],['Midnight','#232A31'],['British green','#2E8B57'],['Arancio','#E8590C'],['Bianco','#F2F2F0']];
// brand, model, year, price, hp, torque, 0-60, top mph, engine, fuel, drivetrain, transmission, seats, stock, hex, shape, category id, description
const CARS = [
['Porsche','911 Carrera S',2026,151700,473,390,3.3,191,'3.0L twin-turbo flat-six','Gas','Rear-wheel drive','8-speed PDK',4,3,'#1F4FD8','coupe',1,'Rear-engine icon with a 2+2 cabin. 0-60 is 3.1 s with Sport Chrono.'],
['Chevrolet','Corvette Stingray',2026,71995,490,465,2.9,194,'6.2L V8 (LT2)','Gas','Rear-wheel drive','8-speed dual-clutch',2,5,'#F2B705','mid',2,'Mid-engine V8. 495 hp and the 2.9 s 0-60 come with the Z51 package.'],
['Ferrari','296 GTB',null,320000,819,545,2.9,205,'3.0L twin-turbo V6 plug-in hybrid','Hybrid','Rear-wheel drive','8-speed dual-clutch',2,2,'#C8102E','mid',2,'V6 plus one electric motor, with about 16 miles of electric range. US pricing varies by configuration.'],
['Lamborghini','Temerario',2026,380000,907,null,2.7,213,'4.0L twin-turbo V8 + 3 electric motors','Hybrid','All-wheel drive','8-speed dual-clutch',2,2,'#2E8B57','mid',2,'Huracan successor with a hybrid V8 and a usable front trunk.'],
['Chevrolet','Corvette Z06',2026,119695,670,460,2.6,189,'5.5L V8 (LT6, flat-plane)','Gas','Rear-wheel drive','8-speed dual-clutch',2,3,'#E8590C','mid',2,'The most powerful naturally aspirated Corvette. Top speed is the high-downforce figure.'],
['Chevrolet','Corvette E-Ray',2026,110595,655,595,2.5,183,'6.2L V8 plus front electric motor','Hybrid','All-wheel drive','8-speed dual-clutch',2,2,'#1F4FD8','mid',2,'The first all-wheel-drive Corvette: 495 hp from the V8 plus 160 hp from the electric motor.'],
['Ford','Mustang Dark Horse',2026,66770,500,418,3.8,168,'5.0L V8 (Coyote)','Gas','Rear-wheel drive','6-speed manual or 10-speed automatic',4,4,'#232A31','coupe',1,'The most powerful naturally aspirated Mustang. 0-60 and top speed are approximate test figures.'],
['Ford','Mustang GT',2026,49495,480,415,null,null,'5.0L V8 (Coyote)','Gas','Rear-wheel drive','6-speed manual or 10-speed automatic',4,6,'#C8102E','coupe',1,'The V8 Mustang. Acceleration and top speed are blank because they could not be confirmed.'],
['Porsche','911 Carrera',2026,132300,388,331,3.9,183,'3.0L twin-turbo flat-six','Gas','Rear-wheel drive','8-speed PDK',4,3,'#AEB4BB','coupe',1,'The entry point to the 911 range.'],
['Porsche','911 Turbo S',2026,227000,701,590,2.4,200,'3.8L twin-turbo flat-six T-Hybrid','Hybrid','All-wheel drive','8-speed PDK',4,1,'#232A31','coupe',1,'Top of the 911 range. The price is approximate.'],
['McLaren','Artura',2026,260400,691,531,3.0,205,'3.0L twin-turbo V6 plug-in hybrid','Hybrid','Rear-wheel drive','8-speed dual-clutch',2,1,'#E8590C','mid',2,'McLaren plug-in hybrid with about 21 miles of electric range.'],
['Aston Martin','Vantage',2026,191000,656,590,3.5,202,'4.0L twin-turbo V8','Gas','Rear-wheel drive','8-speed automatic',2,2,'#2E8B57','coupe',1,'Front-engine V8 sports car from Gaydon, England.'],
['Aston Martin','Vantage Roadster',2026,205900,656,590,3.5,202,'4.0L twin-turbo V8','Gas','Rear-wheel drive','8-speed automatic',2,2,'#1F4FD8','conv',3,'The open-top Vantage with a soft top that folds in under seven seconds. Performance figures are the coupe\'s.'],
['Toyota','GR Supra',2026,58300,382,368,3.9,155,'3.0L turbo inline-six','Gas','Rear-wheel drive','6-speed manual or 8-speed automatic',2,5,'#C8102E','coupe',1,'Final years of the fifth-generation Supra.'],
['Lamborghini','Revuelto',null,608358,1001,null,2.5,217,'6.5L V12 plus 3 electric motors','Hybrid','All-wheel drive','8-speed dual-clutch',2,1,'#F2B705','mid',2,'V12 plug-in hybrid. 0-60 is quoted as 0-62 mph, and the price is the original US starting figure.'],
['BMW','M2',2026,69375,473,406,4.1,null,'3.0L twin-turbo inline-six','Gas','Rear-wheel drive','6-speed manual or 8-speed automatic',4,4,'#E8590C','coupe',1,'The most affordable BMW M car.'],
['BMW','M2 CS',2026,99775,523,479,3.7,188,'3.0L twin-turbo inline-six','Gas','Rear-wheel drive','8-speed automatic',4,2,'#232A31','coupe',1,'Limited-run M2 that is lighter and more powerful.'],
['Nissan','Z Sport',2026,44215,400,350,4.3,null,'3.0L twin-turbo V6','Gas','Rear-wheel drive','6-speed manual or 9-speed automatic',2,6,'#F2B705','coupe',1,'0-60 is for the automatic; the manual is about 4.5 s.'],
['Nissan','Z NISMO',2026,66995,420,384,3.9,null,'3.0L twin-turbo V6','Gas','Rear-wheel drive','9-speed automatic',2,2,'#C8102E','coupe',1,'The track-focused Z with more power than the Sport.']];
const SAMPLE_USERS = [['ayesha','ayesha.khan@example.com'],['daniel','dbrooks@example.com'],['lukas','lukas.meyer@example.com'],['sofia','sofia.rossi@example.com'],['omar','omar.h@example.com'],['emily','emily.chen@example.com']];
const SAMPLE_ORDERS = [['daniel','delivered','2026-06-20',['Corvette Stingray']],['lukas','reserved','2026-07-11',['911 Carrera S']],['sofia','confirmed','2026-07-25',['296 GTB']],['ayesha','reserved','2026-08-05',['911 Carrera S','Corvette Stingray']],['emily','confirmed','2026-08-30',['Temerario']],['omar','reserved','2026-09-04',['Revuelto']],['daniel','confirmed','2026-09-09',['Corvette Z06','GR Supra']],['sofia','delivered','2026-09-12',['Vantage']],['emily','cancelled','2026-09-18',['M2']],['lukas','reserved','2026-09-25',['Artura']]];

async function run({ sample = process.env.SEED_SAMPLE !== 'false' } = {}) {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || '123', 10);
  await query("INSERT INTO users(username,email,password_hash,role) VALUES('admin','admin@apexrow.local',$1,'admin') ON CONFLICT DO NOTHING", [adminHash]);
  if ((await query('SELECT COUNT(*)::int n FROM products')).rows[0].n > 0) return false;
  await tx(async c => {
    for (const b of BRANDS) await c.query('INSERT INTO brands(name,country,founded,website) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', b);
    for (const k of CATS) await c.query('INSERT INTO categories(name,description) VALUES($1,$2) ON CONFLICT DO NOTHING', k);
    for (const k of COLORS) await c.query('INSERT INTO colors(name,hex) VALUES($1,$2) ON CONFLICT DO NOTHING', k);
    const colorIds = (await c.query('SELECT id FROM colors ORDER BY id')).rows.map(r => r.id);
    for (let i = 0; i < CARS.length; i++) {
      const x = CARS[i];
      const b = (await c.query('SELECT id FROM brands WHERE name=$1', [x[0]])).rows[0].id;
      const id = (await c.query('INSERT INTO products(brand_id,category_id,model,model_year,price_usd,hp,torque_lbft,zero_to_sixty,top_speed_mph,engine,fuel,drivetrain,transmission,seats,stock,body_hex,shape,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id',
        [b, x[16], x[1], x[2], x[3], x[4], x[5], x[6], x[7], x[8], x[9], x[10], x[11], x[12], x[13], x[14], x[15], x[17]])).rows[0].id;
      for (let k = 0; k < 4; k++) await c.query('INSERT INTO product_colors(product_id,color_id,extra_usd) VALUES($1,$2,$3)', [id, colorIds[(i + k) % colorIds.length], k === 3 ? 2000 : 0]);
    }
    if (!sample) return;
    const h = await bcrypt.hash('Customer123', 10);
    for (const [u, e] of SAMPLE_USERS) await c.query('INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [u, e, h]);
    for (const [u, st, d, models] of SAMPLE_ORDERS) {
      const uid = (await c.query('SELECT id FROM users WHERE username=$1', [u])).rows[0].id;
      const ps = (await c.query('SELECT id,price_usd FROM products WHERE model = ANY($1)', [models])).rows;
      const dep = Math.round(ps.reduce((t, p) => t + p.price_usd, 0) * 0.05);
      const oid = (await c.query('INSERT INTO orders(user_id,status,deposit_usd,created_at) VALUES($1,$2,$3,$4) RETURNING id', [uid, st, dep, d])).rows[0].id;
      for (const p of ps) await c.query('INSERT INTO order_items(order_id,product_id,unit_price_usd) VALUES($1,$2,$3)', [oid, p.id, p.price_usd]);
    }
  });
  return true;
}
module.exports = { run };
if (require.main === module) run().then(r => { console.log(r ? 'Database seeded.' : 'Products already exist; nothing seeded.'); return pool.end(); }).catch(e => { console.error(e); process.exit(1); });
