CREATE TABLE IF NOT EXISTS brands(id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, country TEXT, founded INT, website TEXT);
CREATE TABLE IF NOT EXISTS categories(id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT);
CREATE TABLE IF NOT EXISTS colors(id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, hex TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products(
  id SERIAL PRIMARY KEY,
  brand_id INT NOT NULL REFERENCES brands(id),
  category_id INT NOT NULL REFERENCES categories(id),
  model TEXT NOT NULL, model_year INT,
  price_usd INT NOT NULL CHECK (price_usd > 0),
  hp INT, torque_lbft INT, zero_to_sixty NUMERIC(3,1), top_speed_mph INT,
  engine TEXT, fuel TEXT NOT NULL CHECK (fuel IN ('Gas','Hybrid','Electric')),
  drivetrain TEXT, transmission TEXT, seats INT DEFAULT 2,
  stock INT NOT NULL DEFAULT 1 CHECK (stock >= 0),
  body_hex TEXT DEFAULT '#C8102E', shape TEXT DEFAULT 'coupe', description TEXT,
  created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS product_images(
  id SERIAL PRIMARY KEY, product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  mime TEXT NOT NULL, data BYTEA NOT NULL, caption TEXT, is_primary BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS product_colors(
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id INT NOT NULL REFERENCES colors(id), extra_usd INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, color_id));
CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY, username TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
  created_at TIMESTAMPTZ DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
CREATE TABLE IF NOT EXISTS cart_items(
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (user_id, product_id));
CREATE TABLE IF NOT EXISTS orders(
  id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','confirmed','delivered','cancelled')),
  deposit_usd INT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS order_items(
  id SERIAL PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id), unit_price_usd INT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
