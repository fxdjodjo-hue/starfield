# 🚀 DEPLOY INSTRUCTIONS - MMO HP Persistence Fix

## 🔥 CRITICAL: Deploy Order (Non Negotiable)

### ✅ CORRECT SEQUENCE:
1. **DB Migration FIRST** ⏰
2. **Server Deploy SECOND** ⏰
3. **Monitor logs** 👀

### ❌ WRONG SEQUENCE (Will Break):
1. Server deploy
2. DB migration

**Result**: Server crashes or silent fallbacks during transition period.

## 📋 Pre-Deploy Checklist

### 1. DB Migration Ready ✅
- [ ] Migration file: `supabase/migrations/20250118000000_fix_null_hp_shield_mmo_correct.sql`
- [ ] Test migration on staging DB first
- [ ] Verify transaction wraps all operations
- [ ] Check NOT NULL constraints added
- [ ] Confirm CHECK constraints prevent negative values

### 2. Server Code Ready ✅
- [ ] No more "NULL = use max" fallbacks removed
- [ ] Error throwing for missing HP data (existing players)
- [ ] Repair system blocks until `isFullyLoaded = true`

### 3. Rollback Plan ✅
- [ ] Backup DB before migration
- [ ] Know how to temporarily disable NOT NULL if needed
- [ ] Have emergency fallback values ready

## 🎯 Deploy Steps

### Step 1: DB Migration
```bash
# Apply migration to production DB
supabase db push

# Verify migration succeeded
supabase db inspect
```

### Step 2: Server Deploy
```bash
# Deploy server code AFTER migration completes
npm run deploy
# OR
docker-compose up -d
```

### Step 3: Monitor & Verify
```bash
# Check logs for errors
tail -f server/logs/*.log | grep -i "missing.*health\|missing.*shield"

# Should see: NO ERRORS after migration
# Should see: Normal HP loading logs
```

## 🚨 Post-Deploy Validation

### ✅ SUCCESS Indicators:
- No "MISSING HEALTH DATA" errors in logs
- Players maintain HP between sessions
- Damaged players stay damaged on login
- Auto-repair works normally after 2-second delay

### ❌ FAILURE Indicators:
- "MISSING HEALTH DATA" errors → Migration failed
- Players always full HP → Code fallback still active
- Login failures → DB constraints too strict

## 🔧 Emergency Rollback

If migration fails:

```sql
-- Temporarily remove constraints (if blocking logins)
ALTER TABLE public.player_currencies
ALTER COLUMN current_health DROP NOT NULL,
ALTER COLUMN current_shield DROP NOT NULL;

-- Restore old fallback behavior temporarily
-- Then investigate root cause
```

## 📊 Expected Log Changes

### BEFORE Migration:
```
💚 LOAD Health from DB: null (NULL = missing data)
🚨 MISSING HEALTH DATA for player xxx
APPLY Health: loaded=null, max=100000, applied=100000
```

### AFTER Migration:
```
💚 LOAD Health from DB: 75000 (NULL = DB error after migration)
APPLY Health: loaded=75000, max=100000, applied=75000
```

## 🎖️ Quality Assurance

- [ ] Test with existing damaged players
- [ ] Test with new players (should spawn full)
- [ ] Test logout → login persistence
- [ ] Verify auto-repair timing (2-second delay)
- [ ] Confirm DB constraints prevent future regressions

---

**Remember**: This is foundation-level infrastructure. Test thoroughly before production deploy! 🛡️