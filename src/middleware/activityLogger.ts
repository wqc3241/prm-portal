import { Request, Response, NextFunction } from 'express';
import db from '../config/database';

/**
 * Activity logger middleware. Runs AFTER the response is sent (on 'finish' event)
 * to log write operations (POST, PATCH, DELETE) to the activity_feed table.
 */
export function activityLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only log mutating operations
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Capture the original json method to intercept response data
  const originalJson = res.json.bind(res);
  let responseData: any = null;

  res.json = function (body: any) {
    responseData = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // Only log successful operations
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    if (!req.user) return;

    // Determine entity type and action from the URL
    const pathParts = req.path.replace('/api/v1/', '').split('/').filter(Boolean);
    if (pathParts.length === 0) return;

    const entityType = pathParts[0];
    let action = 'unknown';
    let entityId: string | null = null;

    switch (req.method) {
      case 'POST':
        action = 'created';
        // Try to get the entity ID from the response
        if (responseData?.data?.id) {
          entityId = responseData.data.id;
        }
        // Check for action-specific paths like /submit, /approve
        if (pathParts.length >= 3) {
          const actionPath = pathParts[pathParts.length - 1];
          if (['submit', 'approve', 'reject', 'login', 'register', 'logout', 'refresh'].includes(actionPath)) {
            action = actionPath;
            entityId = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : entityId;
          }
        }
        break;
      case 'PATCH':
      case 'PUT':
        action = 'updated';
        entityId = pathParts[1] || null;
        break;
      case 'DELETE':
        action = 'deleted';
        entityId = pathParts[1] || null;
        break;
    }

    // Skip auth-related logs (login, refresh, etc.) as they are not entity operations
    if (entityType === 'auth' && ['login', 'refresh', 'logout'].includes(action)) {
      return;
    }

    if (!entityId) return;

    const summary = buildSummary(req.user!, action, entityType, entityId);

    // Fire and forget — do not await
    db('activity_feed')
      .insert({
        actor_id: req.user!.sub,
        organization_id: req.user!.org_id || null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        summary,
        changes: req.method === 'PATCH' || req.method === 'PUT' ? JSON.stringify(req.body) : null,
        ip_address: req.ip || req.socket.remoteAddress || null,
      })
      .catch((err) => {
        console.error('[ActivityLogger] Failed to log activity:', err.message);
      });
  });

  next();
}

function buildSummary(
  user: { sub: string; email: string; role: string },
  action: string,
  entityType: string,
  entityId: string,
): string {
  return `${user.email} ${action} ${entityType} ${entityId}`;
}
