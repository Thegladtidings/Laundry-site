# Freshfold Laundry

A full-stack laundry pickup and delivery app. Customers can choose garment types and quantities, request pickups, upload item photos and track estimates. Administrators manage garment pricing, orders, receipts, cashier accounts and sales reports; cashiers record walk-in sales, verify online orders, collect approved payments and keep order progress up to date.

## Stack

- React, TypeScript, Vite and Tailwind CSS
- Express 5, TypeScript and MongoDB with Mongoose
- JWT authentication and Zod request validation

## Get started

Requirements: Node.js 20.19+ and MongoDB 7+.

1. Install the workspace dependencies:

   ```sh
   npm install
   ```

2. Create the server environment file. In PowerShell:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

   Open `server/.env` and set `MONGO_URI` to your MongoDB connection string. Replace `JWT_SECRET` with a private random secret of at least 32 characters; you can generate one with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Configure the initial administrator in `server/.env`:

   ```dotenv
   SEED_ADMIN_EMAIL=admin@yourdomain.com
   SEED_ADMIN_PASSWORD=use-a-unique-password-of-at-least-12-characters
   SEED_ADMIN_PHONE=your-admin-phone-number
   ```

   Choose a unique email and a strong password of at least 12 characters. The seed command creates the administrator with the name **Laundry Administrator** and username **laundry-admin**. It is safe to rerun for the same administrator email: it will report that the account already exists instead of creating another one. Keep this environment file private; do not commit it.

4. Start MongoDB and create the administrator:

   ```sh
   npm run seed
   ```

   Then start the API and website:

   ```sh
   npm run dev
   ```

The web app is available at `http://localhost:5173`; the API listens on port `3000`. Sign in with the administrator email and password configured above. New accounts created through the public registration page are customer accounts, not staff accounts.

### If MongoDB Atlas reports “bad auth” or “Authentication failed”

The seed command must connect to MongoDB before it can create the administrator. This error means Atlas rejected the database credentials in `MONGO_URI`; it is separate from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

1. In Atlas, open **Security → Database Access** and verify the database user exists and its password is current. This is the MongoDB database user, not your Atlas website sign-in.
2. Copy the application connection string from **Connect → Drivers** into `MONGO_URI` in `server/.env`. Replace the `<username>`, `<password>`, and cluster placeholders with the database user's credentials and your cluster address.
3. If the database password contains reserved URL characters such as `@`, `:`, `/`, `?`, `#`, or `%`, percent-encode the password before putting it in the URI. For example, `@` becomes `%40`. Do not encode the whole connection string.
4. Save the file and rerun `npm run seed` from the repository root or `server` directory. Do not post or send anyone your connection string or database password.

If authentication succeeds but Atlas cannot be reached, check **Security → Network Access** and allow the IP address of the computer running the app. Avoid opening database access to all IP addresses except temporarily for isolated diagnosis.

## Create a cashier account

1. Sign in as an administrator and open the **Operations** workspace from the top navigation.
2. Select the **Staff** tab.
3. Under **Add a cashier**, enter the cashier's name, a unique username, email address, phone number and a temporary password of at least 12 characters.
4. Select **Create cashier account**. Give the cashier their sign-in email and temporary password securely, outside the app.
5. The cashier can sign in from the regular **Sign in** page. Their account opens the **Cashier desk**, where they can record garment-based walk-in sales, link sales to existing customers or create customer accounts with a temporary password, issue receipts, verify customer-submitted orders, collect approved payments and update order progress.

Only administrators can create or deactivate cashiers. Deactivating a cashier immediately prevents further sign-ins and API access; existing sales remain in the ledger. To restore access, an administrator can reactivate the account from the **Staff** tab. Cashiers cannot access staff management or the administrator sales report.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the API and web app together |
| `npm run build` | Build both workspaces |
| `npm run typecheck` | Type-check both workspaces |
| `npm run seed` | Create the configured administrator account |

## Garment pricing and order verification

1. Sign in as an administrator and open **Operations → Garment pricing** to set each garment's price and the per-item stain-removal fee.
2. Customers choose garment types (including native wear, shirts, T-shirts, polos, suits, trousers, uniforms, bedsheets and duvets), quantities and optional stain treatment. They can attach up to three JPEG, PNG or WebP photos per garment type (5 MB each).
3. Customers see an estimate based on the current catalogue. Photos are kept private and can only be viewed by the customer who submitted them and authorized staff.
4. A cashier or administrator reviews the garment type, quantity and stain-removal selection in the order desk. Verification recalculates the total using the current admin-configured prices; payment collection remains unavailable until verification is complete.
5. Cashier walk-in sales use the same material catalogue and stain-removal fee. Cashiers may search for and link a registered customer, create a new customer account using the customer's details and a temporary password, or leave the sale unlinked. The API calculates prices rather than accepting them from the browser.
6. New customer accounts can sign in with their email and the temporary password entered by the cashier. The cashier should share that password securely with the customer.
7. Every registered customer order and cashier walk-in sale receives one four-digit item-tag code (`0001`–`9999`), shared by every garment in that job. Codes remain assigned until the job is marked delivered, then become reusable. Use **Operations → Orders → Search item tag** with the four-digit code and the job's registered date to find current or historical matches; a code may have multiple matches on the same date if it was reused that day. Codes appear in customer order details, staff order management, and receipts. Walk-in jobs can be tracked and marked delivered from the cashier or admin workspace.

## API

- `GET /api/health` — API health check
- `GET /api/services` — service menu
- `GET /api/materials` — public garment catalogue and prices
- `POST /api/auth/register` and `POST /api/auth/login` — create an account or sign in
- `GET /api/auth/me` — current authenticated account
- `GET /api/orders` and `POST /api/orders` — list or schedule garment-based pickups; order creation accepts multipart photos
- `POST /api/orders/:orderId/verify` — staff verification and final-price calculation
- `GET /api/orders/:orderId/photos/:photoId` — retrieve an item photo with authentication and ownership checks
- `PATCH /api/orders/:orderId/status` — staff order status update
- `POST /api/orders/:orderId/payment` — record a verified order payment and issue a receipt
- `GET /api/operations/summary?period=today|7d|30d&ordersPage=1&salesPage=1` — paginated staff sales, orders and operations summary (25 records per page)
- `POST /api/operations/sales` — cashier walk-in sale and receipt
- `GET /api/operations/customers?search=<name-or-contact>` — search registered customer accounts for sale linking
- `GET /api/operations/tags?code=0001&start=<ISO-datetime>&end=<ISO-datetime>` — search item tags by code and local-day time range
- `PATCH /api/operations/walk-ins/:saleId/status` — update walk-in garment delivery status; marking delivered releases the code
- `PUT /api/operations/pricing` — administrator update for garment prices and stain-removal fee
- `GET /api/operations/staff`, `POST /api/operations/staff/cashiers`, and `PATCH /api/operations/staff/:userId/status` — administrator cashier management

Order estimates, verified totals and walk-in sale totals are calculated by the API from the configured garment prices and per-item stain-removal fee. Order payments and walk-in sales are recorded with payment method, cashier and receipt number. Only administrators can create or deactivate cashiers; inactive staff accounts are denied access immediately. Cashiers see their own collected sales and can manage pickups, verification and payments. All operations endpoints require a valid bearer token and staff role.
