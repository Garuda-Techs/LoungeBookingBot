# Deploying to Railway

## Database Strategy (SQLite)
Your project uses **SQLite**, which stores the entire database in a single file (`lounge_bookings.db`).
- **Pros:** Very simple, no separate database server to pay for or configure.
- **Cons:** On cloud platforms like Railway, files are usually "ephemeral" (deleted when you redeploy) unless you use a **Volume**.

**My plan includes setting up a Volume so your database is safe and persistent.**

---

## Deployment Steps

### 1. Push to GitHub
Push your code to a GitHub repository.

### 2. Create Project on Railway
1. Log in to [Railway](https://railway.app).
2. Click **+ New Project** > **Deploy from GitHub repo**.
3. Select your repository.

### 3. Set up Persistence (Crucial for Database)
**Do this immediately after the project is created:**
1. Click on your service (the box with your project name).
2. Go to the **Volumes** tab (or right-click the service > Volume).
3. Click **Add Volume**.
4. Mount path: `/app/data`
   - This tells Railway: "Keep everything in the `/app/data` folder forever, even if I redeploy."

### 4. Configure Environment Variables
Go to the **Variables** tab and add these:

| Variable | Value | Description |
|----------|-------|-------------|
| `TELEGRAM_BOT_TOKEN` | (Your Token) | From BotFather |
| `WEB_APP_URL` | `https://<your-project>.up.railway.app` | You get this after the first deploy (Settings > Networking) |
| `NODE_ENV` | `production` | Optimizes the app for live use |
| `DB_PATH` | `/app/data/lounge_bookings.db` | **Important:** Tells the app to save the DB inside the safe Volume we created in Step 3. |

### 5. Verify
- Once deployed, the bot should respond.
- If you restart or redeploy the app, your bookings will remain because they are saved in `/app/data/lounge_bookings.db`.

## FAQ

**Q: Can I upload my existing local database?**
A: Yes.
1. Install the Railway CLI.
2. Use the command `railway volume:upload` to upload your local `.db` file to the `/app/data` folder on the server.
   *(However, it is usually easier to just start fresh for a new deployment.)*

**Q: Should I use PostgreSQL instead?**
A: PostgreSQL is more robust for heavy traffic, but for a lounge booking bot, SQLite with a Volume is perfectly fine and much cheaper (often free).
