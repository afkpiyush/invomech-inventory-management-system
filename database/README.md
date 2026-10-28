# Database setup

1. Install MySQL 8 and make sure the server is running.
2. Copy `.env.example` to `.env` and set `MYSQL_USER` and `MYSQL_PASSWORD`.
3. Run the migration:

```powershell
Get-Content .\database\migrations\001_initial.sql | mysql -u root -p
```

4. Seed development data:

```powershell
npm run db:seed
```

The seed is idempotent and creates only the two supported application roles. Demo suppliers and prices are synthetic and are marked as demo records; no supplier contact details are presented as verified.
