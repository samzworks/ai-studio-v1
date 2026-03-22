import { storage } from "../storage";
import type { InsertUserNotification, UserNotification, User } from "@shared/schema";

export type NotificationType = 
  | "subscription_started"
  | "subscription_renewed"
  | "subscription_canceled"
  | "subscription_ending"
  | "payment_failed"
  | "trial_ending"
  | "renewal_reminder_14"
  | "renewal_reminder_3"
  | "credits_granted"
  | "credits_low"
  | "plan_changed"
  | "topup_purchased";

interface NotificationData {
  planName?: string;
  credits?: number;
  periodEnd?: string;
  newPlanName?: string;
  oldPlanName?: string;
  packName?: string;
  subscriptionId?: string;
  daysRemaining?: number;
  creditsRemaining?: number;
  [key: string]: unknown;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

async function sendNotificationEmail(
  user: User | undefined,
  type: NotificationType,
  title: string,
  message: string,
  data: NotificationData
): Promise<SendEmailResult> {
  if (!user?.email) {
    return { success: false, error: "No email address" };
  }

  try {
    const { Resend } = await import("resend");
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.log("[NotificationService] Resend API key not configured, skipping email");
      return { success: false, error: "Resend not configured" };
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Tkoeen <noreply@tkoeen.net>";
    const siteName = "Tkoeen";

    const emailContent = generateEmailContent(type, title, message, data, siteName);

    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: title,
      html: emailContent,
    });

    console.log(`[NotificationService] Email sent to ${user.email}: ${type}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[NotificationService] Failed to send email:`, error.message);
    return { success: false, error: error.message };
  }
}

function generateEmailContent(
  type: NotificationType,
  title: string,
  message: string,
  data: NotificationData,
  siteName: string
): string {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN || "https://tkoeen.net";
  
  let ctaButton = "";
  let ctaUrl = "";
  let ctaText = "";

  switch (type) {
    case "subscription_started":
    case "subscription_renewed":
      ctaUrl = `${baseUrl}/`;
      ctaText = "Start Creating";
      break;
    case "payment_failed":
    case "renewal_reminder_14":
    case "renewal_reminder_3":
      ctaUrl = `${baseUrl}/buy-credits`;
      ctaText = "Manage Subscription";
      break;
    case "credits_low":
      ctaUrl = `${baseUrl}/buy-credits`;
      ctaText = "Get More Credits";
      break;
    case "topup_purchased":
    case "credits_granted":
      ctaUrl = `${baseUrl}/`;
      ctaText = "Use Your Credits";
      break;
    default:
      ctaUrl = `${baseUrl}/`;
      ctaText = "Go to Dashboard";
  }

  if (ctaUrl && ctaText) {
    ctaButton = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px auto;">
        <tr>
          <td style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%); border-radius: 8px;">
            <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px;">${ctaText}</a>
          </td>
        </tr>
      </table>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #1a1a2e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a1a2e;">
        <tr>
          <td style="padding: 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #242442; border-radius: 16px; overflow: hidden;">
              <tr>
                <td style="background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%); padding: 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${siteName}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 600;">${title}</h2>
                  <p style="margin: 0 0 24px 0; color: #a0a0b8; font-size: 16px; line-height: 1.6;">${message}</p>
                  ${ctaButton}
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 30px; background-color: #1e1e38; text-align: center;">
                  <p style="margin: 0; color: #6b6b80; font-size: 12px;">
                    © ${new Date().getFullYear()} ${siteName}. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

class NotificationService {
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data: NotificationData = {},
    sendEmail: boolean = true
  ): Promise<UserNotification> {
    const notification = await storage.createNotification({
      userId,
      type,
      title,
      message,
      data,
      isRead: false,
      emailSent: false,
    } as InsertUserNotification);

    if (sendEmail) {
      try {
        const user = await storage.getUser(userId);
        const emailResult = await sendNotificationEmail(user, type, title, message, data);
        
        if (emailResult.success) {
          await storage.markNotificationAsRead(notification.id, userId);
        }
      } catch (error) {
        console.error(`[NotificationService] Email notification failed:`, error);
      }
    }

    console.log(`[NotificationService] Created notification for user ${userId}: ${type}`);
    return notification;
  }

  async notifySubscriptionStarted(userId: string, planName: string, credits: number): Promise<void> {
    await this.notify(
      userId,
      "subscription_started",
      "Welcome to Your New Plan!",
      `Your ${planName} subscription is now active. You've received ${credits} credits to start creating amazing content.`,
      { planName, credits }
    );
  }

  async notifySubscriptionRenewed(userId: string, planName: string, credits: number, periodEnd: Date): Promise<void> {
    await this.notify(
      userId,
      "subscription_renewed",
      "Subscription Renewed",
      `Your ${planName} subscription has been renewed. ${credits} credits have been added to your account. Next billing: ${periodEnd.toLocaleDateString()}.`,
      { planName, credits, periodEnd: periodEnd.toISOString() }
    );
  }

  async notifySubscriptionCanceled(userId: string, planName: string, periodEnd: Date): Promise<void> {
    await this.notify(
      userId,
      "subscription_canceled",
      "Subscription Canceled",
      `Your ${planName} subscription has been canceled. You'll continue to have access until ${periodEnd.toLocaleDateString()}.`,
      { planName, periodEnd: periodEnd.toISOString() }
    );
  }

  async notifyPaymentFailed(userId: string, planName: string): Promise<void> {
    await this.notify(
      userId,
      "payment_failed",
      "Payment Failed",
      `We couldn't process your payment for ${planName}. Please update your payment method to avoid service interruption.`,
      { planName }
    );
  }

  async notifyRenewalReminder(userId: string, planName: string, periodEnd: Date, daysRemaining: number): Promise<void> {
    const type = daysRemaining <= 3 ? "renewal_reminder_3" : "renewal_reminder_14";
    
    const existingNotification = await storage.getUserNotificationByTypeAndData(
      userId,
      type,
      "periodEnd",
      periodEnd.toISOString()
    );
    
    if (existingNotification) {
      console.log(`[NotificationService] Renewal reminder already sent for user ${userId}, period end ${periodEnd.toISOString()}`);
      return;
    }

    await this.notify(
      userId,
      type,
      daysRemaining <= 3 ? "Subscription Ending Soon" : "Renewal Reminder",
      `Your ${planName} subscription renews in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}. Make sure your payment method is up to date.`,
      { planName, periodEnd: periodEnd.toISOString(), daysRemaining }
    );
  }

  async notifyCreditsGranted(
    userId: string,
    credits: number,
    source: "subscription" | "topup" | "admin",
    sourceDescription?: string
  ): Promise<void> {
    let title = "Credits Added";
    let message = `${credits} credits have been added to your account`;
    
    switch (source) {
      case "subscription":
        message = `${credits} credits from your subscription have been added to your account.`;
        break;
      case "topup":
        title = "Credit Pack Purchased";
        message = `${credits} credits from your ${sourceDescription || "credit pack"} purchase have been added.`;
        break;
      case "admin":
        title = "Credits Granted";
        message = `An administrator has granted you ${credits} credits.`;
        break;
    }

    await this.notify(
      userId,
      source === "topup" ? "topup_purchased" : "credits_granted",
      title,
      message,
      { credits, source, sourceDescription }
    );
  }

  async notifyCreditsLow(userId: string, creditsRemaining: number, threshold: number): Promise<void> {
    await this.notify(
      userId,
      "credits_low",
      "Low Credit Balance",
      `You have ${creditsRemaining} credits remaining. Consider purchasing more credits to continue creating.`,
      { creditsRemaining, threshold }
    );
  }

  async notifyPlanChanged(
    userId: string,
    oldPlanName: string,
    newPlanName: string,
    isUpgrade: boolean
  ): Promise<void> {
    await this.notify(
      userId,
      "plan_changed",
      isUpgrade ? "Plan Upgraded" : "Plan Changed",
      isUpgrade
        ? `Congratulations! You've upgraded from ${oldPlanName} to ${newPlanName}. Enjoy your enhanced features!`
        : `Your plan has been changed from ${oldPlanName} to ${newPlanName}.`,
      { oldPlanName, newPlanName, isUpgrade }
    );
  }

  async processRenewalReminders(): Promise<void> {
    console.log("[NotificationService] Processing renewal reminders...");
    
    const subscriptions14Days = await storage.getSubscriptionsNearingEnd(14);
    for (const sub of subscriptions14Days) {
      if (sub.plan && sub.currentPeriodEnd) {
        await this.notifyRenewalReminder(
          sub.userId,
          sub.plan.displayName,
          new Date(sub.currentPeriodEnd),
          14
        );
      }
    }

    const subscriptions3Days = await storage.getSubscriptionsNearingEnd(3);
    for (const sub of subscriptions3Days) {
      if (sub.plan && sub.currentPeriodEnd) {
        await this.notifyRenewalReminder(
          sub.userId,
          sub.plan.displayName,
          new Date(sub.currentPeriodEnd),
          3
        );
      }
    }

    console.log(`[NotificationService] Processed reminders: ${subscriptions14Days.length} (14-day), ${subscriptions3Days.length} (3-day)`);
  }
}

export const notificationService = new NotificationService();
