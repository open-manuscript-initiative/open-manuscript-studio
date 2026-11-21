import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { env } from '../config/env.js';
import { studioFeedbackSchema } from '../model/studioFeedbackSchema.js';
import { formatStudioFeedbackMail } from '../model/studioFeedbackMail.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';

export const studioFeedbackRouter = Router();

const feedbackRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  keyGenerator: (request) => String((request as AuthenticatedRequest).authUserId),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'FEEDBACK_RATE_LIMITED', message: 'Please try again later.' } },
});

async function sendFeedbackMail(reportId: string, data: z.infer<typeof studioFeedbackSchema>): Promise<void> {
  const message = formatStudioFeedbackMail(reportId, data, env.MAIL_FROM, env.OMI_FEEDBACK_RECIPIENT!);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(env.SENDMAIL_PATH, ['-i', '-t'], { stdio: ['pipe', 'ignore', 'pipe'] });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Feedback mail transport exited unsuccessfully.'));
    });
    child.stdin.on('error', () => { /* process close/error carries delivery failure */ });
    child.stdin.end(message);
  });
}

// Disabled unless the current Studio instance operator supplies a recipient.
// Institutional deployments must never send feedback to the central OMI by default.
studioFeedbackRouter.post('/feedback', requireSession, feedbackRateLimit, async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (!env.OMI_FEEDBACK_RECIPIENT) {
    response.status(503).json({ error: { code: 'FEEDBACK_DISABLED', message: 'Feedback is not enabled on this Studio server.' } });
    return;
  }
  const parsed = studioFeedbackSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'INVALID_FEEDBACK', message: 'Please check the feedback form fields.' } });
    return;
  }

  const id = 'OMI-' + randomUUID();
  try {
    await sendFeedbackMail(id, parsed.data);
    response.status(201).json({ id, received: true });
  } catch {
    // Never log feedback bodies or contact addresses.
    response.status(503).json({ error: { code: 'FEEDBACK_DELIVERY_FAILED', message: 'Feedback delivery failed. Please try again.' } });
  }
});
