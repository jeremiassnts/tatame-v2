import { eq } from "drizzle-orm";
import { notificationPreferences, type Database } from "@tatame/db";
import type {
  INotificationPreferencesRepository,
  NotificationPreferencesRow,
} from "./notification-preferences.repository.js";

export class PostgresNotificationPreferencesRepository
  implements INotificationPreferencesRepository
{
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string): Promise<NotificationPreferencesRow | null> {
    const [row] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return row ?? null;
  }

  async upsert(
    userId: string,
    pushEnabled: boolean,
  ): Promise<NotificationPreferencesRow> {
    const [row] = await this.db
      .insert(notificationPreferences)
      .values({ userId, pushEnabled })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { pushEnabled, updatedAt: new Date() },
      })
      .returning();
    return row!;
  }

  async isPushEnabled(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ pushEnabled: notificationPreferences.pushEnabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return row?.pushEnabled ?? true; // default enabled
  }
}
