import { Resend } from 'resend';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@yourdomain.com';
const APP_NAME = process.env.APP_NAME || 'Cehail Plus';
const APP_URL = process.env.REPLIT_DEPLOYMENT_URL 
  ? `https://${process.env.REPLIT_DEPLOYMENT_URL}` 
  : 'http://localhost:5000';

interface ConnectionSettings {
  settings: {
    api_key: string;
    from_email: string;
  };
}

let connectionSettings: ConnectionSettings | null = null;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!hostname || !xReplitToken) {
    console.warn('[EmailService] Replit connectors not available - email notifications disabled');
    return null;
  }

  try {
    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings || !connectionSettings.settings.api_key) {
      console.warn('[EmailService] Resend not connected - email notifications disabled');
      return null;
    }

    console.log('[EmailService] Resend connection configured successfully');
    return {
      apiKey: connectionSettings.settings.api_key, 
      fromEmail: connectionSettings.settings.from_email
    };
  } catch (error) {
    console.error('[EmailService] Failed to fetch Resend credentials:', error);
    return null;
  }
}

async function getResendClient() {
  const credentials = await getCredentials();
  if (!credentials) {
    return null;
  }
  
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  const resendClient = await getResendClient();
  
  if (!resendClient) {
    console.warn('[EmailService] Resend not configured - skipping email:', options.subject);
    return false;
  }

  try {
    const emailPayload: any = {
      from: resendClient.fromEmail,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
    };
    
    if (options.replyTo) {
      emailPayload.reply_to = options.replyTo;
    }
    
    const { data, error } = await resendClient.client.emails.send(emailPayload);

    if (error) {
      console.error('[EmailService] Error sending email:', error);
      return false;
    }

    console.log('[EmailService] Email sent successfully:', data);
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    return false;
  }
}

function getEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #083c4c 0%, #988484 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            background: #ffffff;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .footer {
            background: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-radius: 0 0 8px 8px;
            border: 1px solid #e5e7eb;
            border-top: none;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #083c4c;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
          .info-box {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #083c4c;
          }
          .success {
            border-left-color: #10b981;
          }
          .warning {
            border-left-color: #f59e0b;
          }
          .danger {
            border-left-color: #ef4444;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${APP_NAME}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>This is an automated message from ${APP_NAME}.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </body>
    </html>
  `;
}

export async function sendCreditRequestNotificationToAdmin(
  userName: string,
  userEmail: string,
  requestedAmount: number,
  message: string,
  requestId: number
): Promise<boolean> {
  const content = `
    <h2>New Credit Request</h2>
    <p>A user has submitted a credit request that requires your attention.</p>
    
    <div class="info-box">
      <p><strong>User:</strong> ${userName} (${userEmail})</p>
      <p><strong>Requested Amount:</strong> ${requestedAmount} credits</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    </div>
    
    <p>
      <a href="${APP_URL}/admin?tab=credit-requests" class="button">Review Request</a>
    </p>
    
    <p>Please review this request in the admin dashboard.</p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${APP_NAME}] New Credit Request from ${userName}`,
    html: getEmailTemplate(content),
  });
}

export async function sendCreditRequestApprovedToUser(
  userEmail: string,
  userName: string,
  requestedAmount: number,
  approvedAmount: number,
  adminNote?: string
): Promise<boolean> {
  const content = `
    <h2>Credit Request Approved</h2>
    <p>Hi ${userName},</p>
    
    <p>Great news! Your credit request has been approved.</p>
    
    <div class="info-box success">
      <p><strong>Requested Amount:</strong> ${requestedAmount} credits</p>
      <p><strong>Approved Amount:</strong> ${approvedAmount} credits</p>
      ${adminNote ? `<p><strong>Admin Note:</strong> ${adminNote}</p>` : ''}
    </div>
    
    <p>The credits have been added to your account and are ready to use.</p>
    
    <p>
      <a href="${APP_URL}/dashboard" class="button">View Your Credits</a>
    </p>
    
    <p>Thank you for using ${APP_NAME}!</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `[${APP_NAME}] Credit Request Approved`,
    html: getEmailTemplate(content),
  });
}

export async function sendCreditRequestRejectedToUser(
  userEmail: string,
  userName: string,
  requestedAmount: number,
  adminNote?: string
): Promise<boolean> {
  const content = `
    <h2>Credit Request Update</h2>
    <p>Hi ${userName},</p>
    
    <p>We've reviewed your credit request for ${requestedAmount} credits.</p>
    
    <div class="info-box warning">
      <p><strong>Status:</strong> Not approved at this time</p>
      ${adminNote ? `<p><strong>Admin Note:</strong> ${adminNote}</p>` : ''}
    </div>
    
    <p>If you have any questions or would like to discuss alternative options, please don't hesitate to reach out to our support team.</p>
    
    <p>
      <a href="${APP_URL}/buy-credits" class="button">View Credit Options</a>
    </p>
    
    <p>Thank you for your understanding.</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `[${APP_NAME}] Credit Request Update`,
    html: getEmailTemplate(content),
  });
}

export async function sendAccountStatusChangeNotification(
  userEmail: string,
  userName: string,
  isActive: boolean,
  reason?: string
): Promise<boolean> {
  const content = isActive
    ? `
      <h2>Account Reactivated</h2>
      <p>Hi ${userName},</p>
      
      <p>Your account has been reactivated. You can now access all features of ${APP_NAME}.</p>
      
      <div class="info-box success">
        <p><strong>Status:</strong> Active</p>
        ${reason ? `<p><strong>Note:</strong> ${reason}</p>` : ''}
      </div>
      
      <p>
        <a href="${APP_URL}/login" class="button">Access Your Account</a>
      </p>
    `
    : `
      <h2>Account Status Update</h2>
      <p>Hi ${userName},</p>
      
      <p>Your account has been temporarily suspended.</p>
      
      <div class="info-box danger">
        <p><strong>Status:</strong> Suspended</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      </div>
      
      <p>If you believe this is an error or have questions, please contact our support team.</p>
    `;

  return sendEmail({
    to: userEmail,
    subject: `[${APP_NAME}] Account Status Update`,
    html: getEmailTemplate(content),
  });
}

export async function sendManualCreditAdjustmentNotification(
  userEmail: string,
  userName: string,
  amount: number,
  newBalance: number,
  reason: string
): Promise<boolean> {
  const isAddition = amount > 0;
  const content = `
    <h2>Credit Balance Update</h2>
    <p>Hi ${userName},</p>
    
    <p>Your credit balance has been ${isAddition ? 'increased' : 'decreased'} by an administrator.</p>
    
    <div class="info-box ${isAddition ? 'success' : 'warning'}">
      <p><strong>Adjustment:</strong> ${amount > 0 ? '+' : ''}${amount} credits</p>
      <p><strong>New Balance:</strong> ${newBalance} credits</p>
      <p><strong>Reason:</strong> ${reason}</p>
    </div>
    
    <p>
      <a href="${APP_URL}/dashboard" class="button">View Your Credits</a>
    </p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `[${APP_NAME}] Credit Balance Updated`,
    html: getEmailTemplate(content),
  });
}

export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  initialCredits: number
): Promise<boolean> {
  const content = `
    <h2>Welcome to ${APP_NAME}!</h2>
    <p>Hi ${userName},</p>
    
    <p>Thank you for joining ${APP_NAME}. We're excited to have you on board!</p>
    
    <div class="info-box success">
      <p><strong>Welcome Bonus:</strong> ${initialCredits} credits</p>
      <p>Your account has been credited with ${initialCredits} free credits to get you started.</p>
    </div>
    
    <h3>What's Next?</h3>
    <ul>
      <li>Create stunning AI-generated images</li>
      <li>Generate amazing videos</li>
      <li>Explore our creative tools</li>
    </ul>
    
    <p>
      <a href="${APP_URL}/create" class="button">Start Creating</a>
    </p>
    
    <p>If you have any questions, our support team is here to help!</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `Welcome to ${APP_NAME}!`,
    html: getEmailTemplate(content),
  });
}

export async function sendLowCreditsWarning(
  userEmail: string,
  userName: string,
  currentBalance: number
): Promise<boolean> {
  const content = `
    <h2>Low Credit Balance</h2>
    <p>Hi ${userName},</p>
    
    <p>Your credit balance is running low.</p>
    
    <div class="info-box warning">
      <p><strong>Current Balance:</strong> ${currentBalance} credits</p>
      <p>You may want to add more credits to continue creating.</p>
    </div>
    
    <p>
      <a href="${APP_URL}/buy-credits" class="button">Add Credits</a>
    </p>
    
    <p>Thank you for using ${APP_NAME}!</p>
  `;

  return sendEmail({
    to: userEmail,
    subject: `[${APP_NAME}] Low Credit Balance`,
    html: getEmailTemplate(content),
  });
}

export async function sendNewUserRegistrationToAdmin(
  userId: string,
  userName: string,
  userEmail: string
): Promise<boolean> {
  const content = `
    <h2>New User Registration</h2>
    <p>A new user has registered on ${APP_NAME}.</p>
    
    <div class="info-box success">
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>Name:</strong> ${userName}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      <p><strong>Registered:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <p>
      <a href="${APP_URL}/admin?tab=users" class="button">View Users</a>
    </p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${APP_NAME}] New User Registration: ${userName}`,
    html: getEmailTemplate(content),
  });
}

export async function sendLowCreditsAlertToAdmin(
  userId: string,
  userName: string,
  userEmail: string,
  currentBalance: number
): Promise<boolean> {
  const content = `
    <h2>Low Credits Alert</h2>
    <p>A user's credit balance has dropped below 50 credits.</p>
    
    <div class="info-box warning">
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>Name:</strong> ${userName}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      <p><strong>Current Balance:</strong> ${currentBalance} credits</p>
    </div>
    
    <p>You may want to reach out to this user about adding more credits.</p>
    
    <p>
      <a href="${APP_URL}/admin?tab=users" class="button">View User</a>
    </p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    subject: `[${APP_NAME}] Low Credits Alert: ${userName} (${currentBalance} credits)`,
    html: getEmailTemplate(content),
  });
}

export async function sendContactFormNotification(
  name: string,
  email: string,
  subject: string,
  message: string
): Promise<boolean> {
  const content = `
    <h2>New Contact Form Submission</h2>
    <p>Someone has submitted the contact form on your website.</p>
    
    <div class="info-box">
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message.replace(/\n/g, '<br>')}</p>
    </div>
    
    <p>
      <a href="${APP_URL}/admin" class="button">View in Admin Dashboard</a>
    </p>
    
    <p>You can reply directly to this email to respond to the sender.</p>
  `;

  return sendEmail({
    to: ADMIN_EMAIL,
    replyTo: email,
    subject: `[${APP_NAME}] Contact Form: ${subject}`,
    html: getEmailTemplate(content),
  });
}

export const emailService = {
  sendCreditRequestNotificationToAdmin,
  sendCreditRequestApprovedToUser,
  sendCreditRequestRejectedToUser,
  sendAccountStatusChangeNotification,
  sendManualCreditAdjustmentNotification,
  sendWelcomeEmail,
  sendLowCreditsWarning,
  sendContactFormNotification,
  sendNewUserRegistrationToAdmin,
  sendLowCreditsAlertToAdmin,
};
