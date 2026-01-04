# Starfield Game - Supabase Backend

This directory contains the Supabase configuration and database schema for the Starfield game.

## 🚀 Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (usually 2-3 minutes)

### 2. Configure Environment Variables

Copy `env.example` to `.env` in the project root and fill in your Supabase credentials:

```bash
cp env.example .env
```

Edit `.env` with your project URL and anon key from the Supabase dashboard.

### 3. Run Database Migrations

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-id

# Apply migrations
supabase db push
```

### 4. Generate Types (Optional)

```bash
# Generate TypeScript types from your database schema
supabase gen types typescript --local > src/lib/database.types.ts
```

## 📊 Database Schema

### Core Tables (Single-Player Data Only)

The database schema reflects **exactly** what the current single-player game manages:

- **`user_profiles`** - Basic user information (username, display name)
- **`player_stats`** - Player statistics from `PlayerStats` component:
  - `kills`, `deaths`, `missions_completed`, `play_time`
- **`player_upgrades`** - Player upgrades from `PlayerUpgrades` component:
  - `hp_upgrades`, `shield_upgrades`, `speed_upgrades`, `damage_upgrades`
- **`player_currencies`** - All currency components combined:
  - `Credits`, `Cosmos`, `Experience`, `Honor`, `SkillPoints`
- **`quest_progress`** - Quest progress from `ActiveQuest` + `Quest` components:
  - `quest_id`, `objectives` (JSON array), `is_completed`

### Key Features

- **Row Level Security (RLS)** - Users can only access their own data
- **Minimal Schema** - Only tables that exist in the current game code
- **No Over-Engineering** - No features not implemented in single-player
- **Simple JSON Storage** - Quest objectives stored as JSONB arrays

## 🔧 Development

### Local Development

```bash
# Start Supabase locally
supabase start

# Reset database (WARNING: destroys all data)
supabase db reset

# View database in browser
supabase db diff
```

### Testing

```bash
# Run database tests
supabase test db

# View logs
supabase logs
```

## 🌐 API Usage

The game uses the Supabase client located in `src/lib/supabase.ts`. Key functions:

```typescript
import { auth, gameAPI } from './lib/supabase'

// Authentication
await auth.signUp(email, password, username)
await auth.signIn(email, password)

// Game data
const profile = await gameAPI.getPlayerProfile(userId)
const stats = await gameAPI.getPlayerStats(userId)
const inventory = await gameAPI.getPlayerInventory(userId)
```

## 🔒 Security

- **Authentication**: Supabase Auth handles user registration/login
- **Authorization**: Row Level Security policies protect user data
- **API Keys**: Use environment variables for sensitive data
- **Real-time**: Secure WebSocket connections for multiplayer

## 📈 Monitoring

- **Supabase Dashboard**: View database metrics, logs, and performance
- **Real-time metrics**: Monitor active connections and query performance
- **Error tracking**: Database errors are logged automatically

## 🚀 Deployment

1. Push your changes to your Git repository
2. Supabase automatically deploys database changes
3. Update your production environment variables
4. Test the deployed application

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## 🆘 Troubleshooting

### Common Issues

1. **Migration fails**: Check SQL syntax and dependencies
2. **RLS blocks queries**: Verify policy definitions
3. **Real-time not working**: Check WebSocket connections
4. **Auth errors**: Verify JWT configuration

### Getting Help

- [Supabase Discord](https://supabase.com/discord)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)
