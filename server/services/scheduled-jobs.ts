import { notificationService } from "./notification-service";

let renewalReminderInterval: NodeJS.Timeout | null = null;

export function startScheduledJobs() {
  if (renewalReminderInterval) {
    clearInterval(renewalReminderInterval);
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  
  renewalReminderInterval = setInterval(async () => {
    try {
      console.log("[ScheduledJobs] Running daily renewal reminders check...");
      await notificationService.processRenewalReminders();
      console.log("[ScheduledJobs] Daily renewal reminders check completed.");
    } catch (error) {
      console.error("[ScheduledJobs] Error processing renewal reminders:", error);
    }
  }, MS_PER_DAY);

  console.log("[ScheduledJobs] Scheduled renewal reminder job (runs daily)");
  
  const now = new Date();
  const hours = now.getHours();
  
  if (hours >= 8 && hours <= 10) {
    setTimeout(async () => {
      try {
        console.log("[ScheduledJobs] Running initial renewal reminders check...");
        await notificationService.processRenewalReminders();
        console.log("[ScheduledJobs] Initial renewal reminders check completed.");
      } catch (error) {
        console.error("[ScheduledJobs] Error in initial renewal check:", error);
      }
    }, 30000);
  }
}

export function stopScheduledJobs() {
  if (renewalReminderInterval) {
    clearInterval(renewalReminderInterval);
    renewalReminderInterval = null;
    console.log("[ScheduledJobs] Stopped scheduled jobs");
  }
}
