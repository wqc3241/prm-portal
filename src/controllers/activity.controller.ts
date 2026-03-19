import { Request, Response, NextFunction } from 'express';
import activityRepository from '../repositories/activity.repository';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class ActivityController {
  // GET /activity
  async listActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        entity_type: req.query.entity_type as string | undefined,
        entity_id: req.query.entity_id as string | undefined,
        actor_id: req.query.actor_id as string | undefined,
        action: req.query.action as string | undefined,
        organization_id: req.query.organization_id as string | undefined,
        since: req.query.since as string | undefined,
        until: req.query.until as string | undefined,
      };

      const { data, total } = await activityRepository.list(
        req.orgScope!,
        filters,
        pagination,
        req.query.sort as string,
      );

      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }
}

export default new ActivityController();
