import leadRepository from '../repositories/lead.repository';
import notificationService from '../services/notification.service';
import db from '../config/database';
import { SYSTEM_USER_EMAIL } from '../config/constants';

/**
 * Lead SLA Check Job
 *
 * Runs every 4 hours and performs two actions:
 *
 * 1. Sends 24-hour warning notifications for leads approaching SLA deadline
 *    (sla_deadline between NOW and NOW + 24 hours, status = 'assigned').
 *
 * 2. Auto-returns leads that have breached the 48-hour SLA deadline
 *    (sla_deadline < NOW, status = 'assigned').
 *
 * Schedule: Every 4 hours (cron: '0 *\/4 * * *')
 * Idempotent:
 *   - Warnings: checks for existing warning notification before creating a new one
 *   - Auto-returns: WHERE status = 'assigned' prevents re-processing returned leads
 */
export async function processLeadSlaChecks(): Promise<{
  warnings_sent: number;
  auto_returned: number;
  errors: number;
}> {
  let warningsSent = 0;
  let autoReturned = 0;
  let errorCount = 0;

  // Get system user for changed_by
  const systemUser = await db('users')
    .select('id')
    .where('email', SYSTEM_USER_EMAIL)
    .first();

  let systemUserId = systemUser?.id;
  if (!systemUserId) {
    const admin = await db('users')
      .select('id')
      .where('role', 'admin')
      .where('is_active', true)
      .first();
    systemUserId = admin?.id;
  }

  if (!systemUserId) {
    console.error('Lead SLA check job: no system or admin user found. Aborting.');
    return { warnings_sent: 0, auto_returned: 0, errors: 0 };
  }

  // ─── Action 1: Send 24-hour warning notifications ──────────────────
  try {
    const approachingLeads = await leadRepository.findApproachingSla();
    console.log(`Lead SLA check: ${approachingLeads.length} leads approaching SLA deadline.`);

    for (const lead of approachingLeads) {
      try {
        // Idempotency: check if a warning was already sent in the last 24 hours
        const warningExists = await notificationService.reminderExists(
          'lead',
          lead.id,
          'SLA deadline approaching',
        );

        if (warningExists) {
          continue; // Skip, already warned
        }

        // Calculate hours remaining
        const now = new Date();
        const deadline = new Date(lead.sla_deadline);
        const hoursRemaining = Math.max(0, Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

        // Find partner admin of assigned org
        if (!lead.assigned_org_id) continue;

        const partnerAdmin = await db('users')
          .where('organization_id', lead.assigned_org_id)
          .where('role', 'partner_admin')
          .where('is_active', true)
          .first();

        if (partnerAdmin) {
          await notificationService.createNotification({
            user_id: partnerAdmin.id,
            type: 'lead_assigned',
            title: `Lead ${lead.lead_number} SLA deadline approaching - ${hoursRemaining}h remaining`,
            body: `${lead.first_name} ${lead.last_name}${lead.company_name ? ` at ${lead.company_name}` : ''} must be accepted within ${hoursRemaining} hours.`,
            entity_type: 'lead',
            entity_id: lead.id,
            action_url: `/leads/${lead.id}`,
          });

          // Log activity
          await leadRepository.insertActivity({
            actor_id: systemUserId,
            action: 'sla_warning_sent',
            entity_type: 'lead',
            entity_id: lead.id,
            summary: `SLA warning sent for lead ${lead.lead_number} - ${hoursRemaining}h remaining`,
            changes: { hours_remaining: hoursRemaining },
            organization_id: lead.assigned_org_id,
          });

          warningsSent++;
        }
      } catch (err) {
        errorCount++;
        console.error(`Lead SLA check: failed to send warning for lead ${lead.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Lead SLA check: failed to query approaching SLA leads:', err);
  }

  // ─── Action 2: Auto-return SLA-breached leads ──────────────────────
  try {
    const breachedLeads = await leadRepository.findPastSla();
    console.log(`Lead SLA check: ${breachedLeads.length} leads past SLA deadline.`);

    for (const lead of breachedLeads) {
      try {
        const oldOrgId = lead.assigned_org_id;

        // Auto-return with optimistic concurrency
        const updated = await leadRepository.updateStatus(lead.id, 'assigned', 'returned', {
          return_reason: `Auto-returned: SLA deadline exceeded (48 hours). Deadline was ${lead.sla_deadline}.`,
          assigned_org_id: null,
          assigned_user_id: null,
          accepted_at: null,
          sla_deadline: null,
        });

        if (!updated) {
          // Lead was already transitioned (e.g., accepted between query and update)
          continue;
        }

        // Log SLA breach in activity feed
        await leadRepository.insertActivity({
          actor_id: systemUserId,
          action: 'sla_breach',
          entity_type: 'lead',
          entity_id: lead.id,
          summary: `Lead ${lead.lead_number} auto-returned due to SLA breach`,
          changes: {
            status: { old: 'assigned', new: 'returned' },
            reason: 'SLA breach',
            sla_deadline: lead.sla_deadline,
          },
          organization_id: oldOrgId,
        });

        // Notify partner admin of the former org
        if (oldOrgId) {
          const partnerAdmin = await db('users')
            .where('organization_id', oldOrgId)
            .where('role', 'partner_admin')
            .where('is_active', true)
            .first();

          if (partnerAdmin) {
            await notificationService.createNotification({
              user_id: partnerAdmin.id,
              type: 'lead_assigned',
              title: `Lead ${lead.lead_number} auto-returned - SLA breach`,
              body: 'This lead was automatically returned because the 48-hour acceptance deadline was not met.',
              entity_type: 'lead',
              entity_id: lead.id,
              action_url: `/leads/${lead.id}`,
            });
          }
        }

        autoReturned++;
      } catch (err) {
        errorCount++;
        console.error(`Lead SLA check: failed to auto-return lead ${lead.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Lead SLA check: failed to query past-SLA leads:', err);
  }

  console.log(
    `Lead SLA check completed. Warnings sent: ${warningsSent}. Auto-returned: ${autoReturned}. Errors: ${errorCount}.`,
  );

  return { warnings_sent: warningsSent, auto_returned: autoReturned, errors: errorCount };
}
