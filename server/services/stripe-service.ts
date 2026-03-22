import Stripe from "stripe";
import { storage as dbStorage } from "../storage";
import { creditService } from "./credit-service";
import { notificationService } from "./notification-service";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

let stripe: Stripe | null = null;

if (stripeSecretKey) {
  stripe = new Stripe(stripeSecretKey);
  console.log("[Stripe] Stripe client initialized successfully");
} else {
  console.warn("[Stripe] STRIPE_SECRET_KEY not set - Stripe functionality disabled");
}

// Helper to extract subscription period info
function getSubscriptionPeriod(sub: any): { start: Date; end: Date } {
  const startTimestamp = sub.current_period_start || sub.start_date || Math.floor(Date.now() / 1000);
  const endTimestamp = sub.current_period_end || (startTimestamp + 30 * 24 * 60 * 60);
  return {
    start: new Date(startTimestamp * 1000),
    end: new Date(endTimestamp * 1000),
  };
}

export function isStripeConfigured(): boolean {
  return !!stripe;
}

export function getStripe(): Stripe {
  if (!stripe) {
    throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
  }
  return stripe;
}

export class StripeService {
  async createCheckoutSessionForSubscription(
    userId: string,
    planId: number,
    couponCode?: string,
    successUrl?: string,
    cancelUrl?: string,
    isAnnual?: boolean
  ): Promise<{ sessionId: string; url: string }> {
    const stripeClient = getStripe();
    
    const plan = await dbStorage.getSubscriptionPlan(planId);
    if (!plan) {
      throw new Error("Subscription plan not found");
    }
    
    // Use annual price ID if requested and available, otherwise fall back to monthly
    const stripePriceId = isAnnual && plan.annualStripePriceId 
      ? plan.annualStripePriceId 
      : plan.stripePriceId;
    
    if (!stripePriceId) {
      throw new Error("Subscription plan has no Stripe price configured");
    }
    
    const user = await dbStorage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    let customerId: string | undefined;
    const existingSubscription = await dbStorage.getUserSubscription(userId);
    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
    }
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.REPLIT_DEV_DOMAIN || ""}/?subscription=success`,
      cancel_url: cancelUrl || `${process.env.REPLIT_DEV_DOMAIN || ""}/pricing?canceled=true`,
      metadata: {
        userId,
        planId: planId.toString(),
        type: "subscription",
      },
      subscription_data: {
        metadata: {
          userId,
          planId: planId.toString(),
        },
      },
    };
    
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }
    
    if (couponCode) {
      const coupon = await dbStorage.getCouponByCode(couponCode);
      if (coupon && coupon.isActive && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date())) {
        if (coupon.appliesTo === "plans" || coupon.appliesTo === "both") {
          const userRedemptionCount = await dbStorage.getUserCouponRedemptionCount(userId, coupon.id);
          if (
            (!coupon.maxRedemptions || coupon.redemptionCount < coupon.maxRedemptions) &&
            (!coupon.maxRedemptionsPerUser || userRedemptionCount < coupon.maxRedemptionsPerUser)
          ) {
            sessionParams.discounts = [{ coupon: couponCode }];
          }
        }
      }
    }
    
    const session = await stripeClient.checkout.sessions.create(sessionParams);
    
    return {
      sessionId: session.id,
      url: session.url || "",
    };
  }

  async createCheckoutSessionForTopup(
    userId: string,
    packId: number,
    couponCode?: string,
    successUrl?: string,
    cancelUrl?: string
  ): Promise<{ sessionId: string; url: string }> {
    const stripeClient = getStripe();
    
    const pack = await dbStorage.getTopupPack(packId);
    if (!pack) {
      throw new Error("Top-up pack not found");
    }
    
    if (!pack.stripePriceId) {
      throw new Error("Top-up pack has no Stripe price configured");
    }
    
    const user = await dbStorage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    let customerId: string | undefined;
    const existingSubscription = await dbStorage.getUserSubscription(userId);
    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
    }
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: pack.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl || `${process.env.REPLIT_DEV_DOMAIN || ""}/?topup=success`,
      cancel_url: cancelUrl || `${process.env.REPLIT_DEV_DOMAIN || ""}/buy-credits?canceled=true`,
      metadata: {
        userId,
        packId: packId.toString(),
        type: "topup",
      },
    };
    
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (user.email) {
      sessionParams.customer_email = user.email;
    }
    
    if (couponCode) {
      const coupon = await dbStorage.getCouponByCode(couponCode);
      if (coupon && coupon.isActive && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date())) {
        if (coupon.appliesTo === "topups" || coupon.appliesTo === "both") {
          const userRedemptionCount = await dbStorage.getUserCouponRedemptionCount(userId, coupon.id);
          if (
            (!coupon.maxRedemptions || coupon.redemptionCount < coupon.maxRedemptions) &&
            (!coupon.maxRedemptionsPerUser || userRedemptionCount < coupon.maxRedemptionsPerUser)
          ) {
            sessionParams.discounts = [{ coupon: couponCode }];
          }
        }
      }
    }
    
    const session = await stripeClient.checkout.sessions.create(sessionParams);
    
    return {
      sessionId: session.id,
      url: session.url || "",
    };
  }

  async createCustomerPortalSession(
    userId: string,
    returnUrl?: string
  ): Promise<{ url: string }> {
    const stripeClient = getStripe();
    
    const subscription = await dbStorage.getUserSubscription(userId);
    if (!subscription?.stripeCustomerId) {
      throw new Error("No Stripe customer found for this user");
    }
    
    const session = await stripeClient.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl || `${process.env.REPLIT_DEV_DOMAIN || ""}/settings`,
    });
    
    return { url: session.url };
  }

  async handleWebhook(payload: string | Buffer, signature: string): Promise<void> {
    if (!webhookSecret) {
      throw new Error("Stripe webhook secret not configured");
    }
    
    const stripeClient = getStripe();
    let event: Stripe.Event;
    
    try {
      event = stripeClient.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
    
    console.log(`[Stripe Webhook] Received event: ${event.type}`);
    
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { userId, planId, packId, type } = session.metadata || {};
    
    if (!userId) {
      console.error("[Stripe Webhook] No userId in checkout session metadata");
      return;
    }
    
    if (type === "subscription" && planId) {
      console.log(`[Stripe Webhook] Subscription checkout completed for user ${userId}, plan ${planId}`);
    } else if (type === "topup" && packId) {
      await this.processTopupPurchase(userId, parseInt(packId), session);
    }
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const { userId, planId } = subscription.metadata || {};
    
    if (!userId || !planId) {
      console.error("[Stripe Webhook] Missing userId or planId in subscription metadata");
      return;
    }
    
    const plan = await dbStorage.getSubscriptionPlan(parseInt(planId));
    if (!plan) {
      console.error(`[Stripe Webhook] Plan ${planId} not found`);
      return;
    }
    
    const { start: periodStart, end: periodEnd } = getSubscriptionPeriod(subscription);
    
    const existingSubscription = await dbStorage.getUserSubscription(userId);
    
    if (existingSubscription) {
      await dbStorage.updateUserSubscription(existingSubscription.id, {
        planId: parseInt(planId),
        status: subscription.status as string,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end || false,
      });
    } else {
      await dbStorage.createUserSubscription({
        userId,
        planId: parseInt(planId),
        status: subscription.status as string,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
      });
    }
    
    if (plan.includedCredits > 0) {
      await creditService.grantSubscriptionCredits(
        userId,
        plan.includedCredits,
        periodEnd,
        subscription.id
      );
    }
    
    await notificationService.notifySubscriptionStarted(userId, plan.displayName, plan.includedCredits);
    
    console.log(`[Stripe Webhook] Subscription created for user ${userId}: ${plan.displayName}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const { userId, planId } = subscription.metadata || {};
    const sub = subscription as any;
    const { start: periodStart, end: periodEnd } = getSubscriptionPeriod(sub);
    
    if (!userId) {
      const existingSub = await dbStorage.getUserSubscriptionByStripeId(subscription.id);
      if (existingSub) {
        await dbStorage.updateUserSubscription(existingSub.id, {
          status: subscription.status as string,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: sub.cancel_at_period_end || false,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        });
        
        console.log(`[Stripe Webhook] Subscription updated for user ${existingSub.userId}: status=${subscription.status}`);
      }
      return;
    }
    
    const existingSub = await dbStorage.getUserSubscription(userId);
    if (existingSub) {
      await dbStorage.updateUserSubscription(existingSub.id, {
        status: subscription.status as string,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      });
    }
    
    console.log(`[Stripe Webhook] Subscription updated for user ${userId}: status=${subscription.status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const existingSub = await dbStorage.getUserSubscriptionByStripeId(subscription.id);
    
    if (existingSub) {
      await dbStorage.updateUserSubscription(existingSub.id, {
        status: "canceled",
        canceledAt: new Date(),
      });
      
      const plan = existingSub.planId ? await dbStorage.getSubscriptionPlan(existingSub.planId) : null;
      const planName = plan?.displayName || "your subscription";
      const periodEnd = existingSub.currentPeriodEnd || new Date();
      
      await notificationService.notifySubscriptionCanceled(existingSub.userId, planName, new Date(periodEnd));
      
      console.log(`[Stripe Webhook] Subscription deleted for user ${existingSub.userId}`);
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const inv = invoice as any;
    if (!inv.subscription) {
      return;
    }
    
    const stripeClient = getStripe();
    const subscription = await stripeClient.subscriptions.retrieve(inv.subscription as string) as any;
    const { userId, planId } = subscription.metadata || {};
    const { start: periodStart, end: periodEnd } = getSubscriptionPeriod(subscription);
    
    if (!userId || !planId) {
      const existingSub = await dbStorage.getUserSubscriptionByStripeId(subscription.id);
      if (existingSub) {
        const plan = await dbStorage.getSubscriptionPlan(existingSub.planId);
        if (plan && plan.includedCredits > 0) {
          await creditService.grantSubscriptionCredits(
            existingSub.userId,
            plan.includedCredits,
            periodEnd,
            subscription.id
          );
          
          await notificationService.notifySubscriptionRenewed(
            existingSub.userId,
            plan.displayName,
            plan.includedCredits,
            periodEnd
          );
          
          console.log(`[Stripe Webhook] Granted ${plan.includedCredits} credits for subscription renewal (user ${existingSub.userId})`);
        }
      }
      return;
    }
    
    const plan = await dbStorage.getSubscriptionPlan(parseInt(planId));
    if (!plan) {
      return;
    }
    
    const existingSub = await dbStorage.getUserSubscription(userId);
    if (existingSub) {
      await dbStorage.updateUserSubscription(existingSub.id, {
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });
    }
    
    if (plan.includedCredits > 0) {
      await creditService.grantSubscriptionCredits(
        userId,
        plan.includedCredits,
        periodEnd,
        subscription.id
      );
      
      await notificationService.notifySubscriptionRenewed(userId, plan.displayName, plan.includedCredits, periodEnd);
      
      console.log(`[Stripe Webhook] Granted ${plan.includedCredits} credits for invoice.paid (user ${userId})`);
    }
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const inv = invoice as any;
    if (!inv.subscription) {
      return;
    }
    
    const existingSub = await dbStorage.getUserSubscriptionByStripeId(inv.subscription as string);
    if (existingSub) {
      await dbStorage.updateUserSubscription(existingSub.id, {
        status: "past_due",
      });
      
      const plan = existingSub.planId ? await dbStorage.getSubscriptionPlan(existingSub.planId) : null;
      const planName = plan?.displayName || "your subscription";
      
      await notificationService.notifyPaymentFailed(existingSub.userId, planName);
      
      console.log(`[Stripe Webhook] Invoice payment failed for user ${existingSub.userId}`);
    }
  }

  private async processTopupPurchase(
    userId: string,
    packId: number,
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const existingPurchase = await dbStorage.getTopupPurchaseByStripeSessionId(session.id);
    if (existingPurchase) {
      console.log(`[Stripe Webhook] Topup purchase already processed for session ${session.id}`);
      return;
    }
    
    const pack = await dbStorage.getTopupPack(packId);
    if (!pack) {
      console.error(`[Stripe Webhook] Pack ${packId} not found`);
      return;
    }
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + pack.expiresInDays);
    
    const pricePaid = session.amount_total || pack.priceCents;
    
    const purchase = await dbStorage.createTopupPurchase({
      userId,
      packId,
      creditsGranted: pack.creditsAmount,
      pricePaidCents: pricePaid,
      currency: session.currency || "usd",
      expiresAt,
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent as string,
      status: "completed",
    });
    
    await creditService.grantTopupCredits(
      userId,
      pack.creditsAmount,
      pack.expiresInDays,
      purchase.id,
      pack.name
    );
    
    await notificationService.notifyCreditsGranted(userId, pack.creditsAmount, "topup", pack.name);
    
    console.log(`[Stripe Webhook] Processed top-up purchase for user ${userId}: ${pack.creditsAmount} credits`);
  }

  async createStripePriceForPlan(plan: {
    name: string;
    priceCents: number;
    billingPeriodMonths: number;
    currency?: string;
  }): Promise<{ priceId: string; productId: string }> {
    const stripeClient = getStripe();
    
    const product = await stripeClient.products.create({
      name: plan.name,
      metadata: { type: "subscription_plan" },
    });
    
    const intervalMap: Record<number, Stripe.PriceCreateParams.Recurring.Interval> = {
      1: "month",
      3: "month",
      6: "month",
      12: "year",
    };
    
    const interval = intervalMap[plan.billingPeriodMonths] || "month";
    const intervalCount = plan.billingPeriodMonths <= 6 ? plan.billingPeriodMonths : 1;
    
    const price = await stripeClient.prices.create({
      product: product.id,
      unit_amount: plan.priceCents,
      currency: plan.currency || "usd",
      recurring: {
        interval,
        interval_count: intervalCount,
      },
    });
    
    return {
      priceId: price.id,
      productId: product.id,
    };
  }

  async createStripePriceForPack(pack: {
    name: string;
    priceCents: number;
    currency?: string;
  }): Promise<{ priceId: string; productId: string }> {
    const stripeClient = getStripe();
    
    const product = await stripeClient.products.create({
      name: pack.name,
      metadata: { type: "topup_pack" },
    });
    
    const price = await stripeClient.prices.create({
      product: product.id,
      unit_amount: pack.priceCents,
      currency: pack.currency || "usd",
    });
    
    return {
      priceId: price.id,
      productId: product.id,
    };
  }

  async syncCouponToStripe(coupon: {
    code: string;
    type: string;
    value: number;
    maxRedemptions?: number | null;
    expiresAt?: Date | null;
  }): Promise<string> {
    const stripeClient = getStripe();
    
    const couponParams: Stripe.CouponCreateParams = {
      id: coupon.code,
      name: coupon.code,
    };
    
    if (coupon.type === "percent") {
      couponParams.percent_off = coupon.value;
    } else {
      couponParams.amount_off = coupon.value;
      couponParams.currency = "usd";
    }
    
    if (coupon.maxRedemptions) {
      couponParams.max_redemptions = coupon.maxRedemptions;
    }
    
    if (coupon.expiresAt) {
      couponParams.redeem_by = Math.floor(coupon.expiresAt.getTime() / 1000);
    }
    
    const stripeCoupon = await stripeClient.coupons.create(couponParams);
    return stripeCoupon.id;
  }
}

export const stripeService = new StripeService();
