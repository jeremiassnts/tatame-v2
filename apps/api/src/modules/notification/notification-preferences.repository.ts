export type NotificationPreferencesRow = {
  id: string;
  userId: string;
  pushEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export interface INotificationPreferencesRepository {
  findByUserId(userId: string): Promise<NotificationPreferencesRow | null>;
  upsert(userId: string, pushEnabled: boolean): Promise<NotificationPreferencesRow>;
  isPushEnabled(userId: string): Promise<boolean>;
}
