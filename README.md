# Apex Row: sports car store for AWS

A three-tier web application: browser, Node.js/Express server, PostgreSQL database server.
Built to be deployed on AWS (EC2 for the app, RDS for the database).

## Modules
| Module | What it does |
|---|---|
| 1. Accounts and access | Sign up, log in, log out, roles (customer or admin), admin user management |
| 2. Catalogue and inventory | Browse, search, filter and sort 19 real cars, car detail page, admin add/edit/delete cars, stock, photos stored in the database |
| 3. Cart and orders | Server-side cart, checkout with a 5% deposit, order history, admin order status changes (cancelling restocks) |

Database tables (PostgreSQL): `users`, `brands`, `categories`, `colors`, `products`, `product_images` (BYTEA photos), `product_colors`, `cart_items`, `orders`, `order_items`.

## Accounts after seeding
- Admin: username `admin`, password `123` (change it with `ADMIN_PASSWORD` before the first seed)
- Sample customers: `ayesha`, `daniel`, `lukas`, `sofia`, `omar`, `emily`, all with password `Customer123`

## Run locally
```bash
npm install
cp .env.example .env     # set DATABASE_URL to a local PostgreSQL database
npm start                # creates tables and seeds data on first start
# open http://localhost:3000
```
Run the included tests against a throwaway database (it wipes that database):
```bash
DATABASE_URL=postgres://user:pass@localhost:5432/apexrow_test npm test
```

## Deploy on AWS (EC2 + RDS)
**1. Database (RDS)**
1. RDS > Create database > PostgreSQL, Free tier template, `db.t3.micro` (or `db.t4g.micro`).
2. Set the master username and password, initial database name `apexrow`, Public access: No.
3. Note the endpoint, for example `apexrow.xxxx.us-east-1.rds.amazonaws.com`.

**2. Server (EC2)**
1. EC2 > Launch instance > Ubuntu 24.04, `t2.micro` or `t3.micro`, create a key pair.
2. Security group of the instance: allow SSH (22) from your IP, HTTP (80) from anywhere.
3. Security group of the RDS database: allow PostgreSQL (5432) from the EC2 instance's security group only.

**3. Install and run (on the EC2 instance)**
```bash
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2

# copy the project here (scp, git clone, or unzip), then:
cd apex-row && npm ci --omit=dev
cp .env.example .env && nano .env      # fill in DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD
pm2 start src/server.js --name apexrow
pm2 save && pm2 startup                 # run the command it prints so the app restarts on reboot
```
`.env` example:
```
PORT=3000
DATABASE_URL=postgres://MASTERUSER:PASSWORD@YOUR-RDS-ENDPOINT:5432/apexrow
PGSSL=true
JWT_SECRET=a-long-random-string
ADMIN_PASSWORD=123
```
**4. Put nginx in front (port 80 to 3000)**
```bash
sudo tee /etc/nginx/sites-available/default >/dev/null <<'CONF'
server { listen 80; client_max_body_size 20m;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; } }
CONF
sudo nginx -t && sudo systemctl restart nginx
```
Open `http://YOUR-EC2-PUBLIC-IP/`. Health check URL: `/api/health` (returns `{"status":"ok","database":"up"}`).

## Service models for the report
- **IaaS:** EC2 (virtual server you configure yourself).
- **DBaaS / managed service:** RDS PostgreSQL (AWS runs the database server for you).
- **PaaS alternative:** Elastic Beanstalk (upload the zip, set the same environment variables, point it at the RDS database).

## Useful URLs for testing
`/` `/?q=porsche&fuel=Hybrid` `/cars/1` `/signup` `/login` `/cart` `/orders` `/admin` `/admin/products` `/admin/orders` `/admin/users` `/api/health` `/api/products`

Test push for Jenkins
Test push for Jenkins
