import { db } from "../db";
import { userCredits, creditLedger, users } from "@shared/schema";
import { eq, isNull, and } from "drizzle-orm";

async function migrateCreditsToLedger() {
  console.log("Starting credit migration to ledger...");
  
  try {
    const existingUserCredits = await db.select().from(userCredits);
    console.log(`Found ${existingUserCredits.length} users with credits to migrate`);
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const userCredit of existingUserCredits) {
      const userId = userCredit.userId;
      const balance = userCredit.balance;
      
      if (balance <= 0) {
        skipped++;
        continue;
      }
      
      const existingEntry = await db.select()
        .from(creditLedger)
        .where(and(
          eq(creditLedger.userId, userId),
          eq(creditLedger.sourceId, `migration_${userId}`)
        ))
        .limit(1);
      
      if (existingEntry.length > 0) {
        console.log(`User ${userId} already migrated, skipping`);
        skipped++;
        continue;
      }
      
      try {
        await db.insert(creditLedger).values({
          userId,
          sourceType: "admin_grant",
          sourceId: `migration_${userId}`,
          amount: balance,
          expiresAt: null,
          description: "Migrated from legacy credit system"
        });
        
        console.log(`Migrated ${balance} credits for user ${userId}`);
        migrated++;
      } catch (error) {
        console.error(`Error migrating user ${userId}:`, error);
        errors++;
      }
    }
    
    console.log("\nMigration complete:");
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
    
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

migrateCreditsToLedger();
