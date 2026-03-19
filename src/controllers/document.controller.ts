import { Request, Response, NextFunction } from 'express';
import documentService from '../services/document.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class DocumentController {
  // ═══════════════════════════════════════════════════════════════════════
  // FOLDERS
  // ═══════════════════════════════════════════════════════════════════════

  // GET /documents/folders
  async listFolders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await documentService.listFolders(req.user!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /documents/folders
  async createFolder(req: Request, res: Response, next: NextFunction) {
    try {
      const folder = await documentService.createFolder(req.body, req.user!);
      sendSuccess(res, folder, 201);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /documents/folders/:id
  async updateFolder(req: Request, res: Response, next: NextFunction) {
    try {
      const folder = await documentService.updateFolder(req.params.id as string, req.body, req.user!);
      sendSuccess(res, folder, 200);
    } catch (err) {
      next(err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════

  // GET /documents
  async listDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        folder_id: req.query.folder_id as string | undefined,
        file_type: req.query.file_type as string | undefined,
        tags: req.query.tags as string | undefined,
        search: req.query.search as string | undefined,
        is_featured: req.query.is_featured !== undefined
          ? req.query.is_featured === 'true'
          : undefined,
      };

      const { data, total } = await documentService.listDocuments(
        filters,
        req.user!,
        pagination,
        req.query.sort as string,
      );

      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  // GET /documents/:id
  async getDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await documentService.getDocument(req.params.id as string, req.user!);
      sendSuccess(res, doc, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /documents
  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      // Parse JSON arrays from multipart form data if needed
      let data = { ...req.body };
      if (typeof data.visible_to_tiers === 'string') {
        try { data.visible_to_tiers = JSON.parse(data.visible_to_tiers); } catch { /* keep as-is */ }
      }
      if (typeof data.tags === 'string') {
        try { data.tags = JSON.parse(data.tags); } catch { /* keep as-is */ }
      }
      if (typeof data.notify_partners === 'string') {
        data.notify_partners = data.notify_partners === 'true';
      }
      if (typeof data.internal_only === 'string') {
        data.internal_only = data.internal_only === 'true';
      }
      if (typeof data.is_featured === 'string') {
        data.is_featured = data.is_featured === 'true';
      }

      const doc = await documentService.uploadDocument(data, req.user!);
      sendSuccess(res, doc, 201);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /documents/:id
  async updateDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await documentService.updateDocument(req.params.id as string, req.body, req.user!);
      sendSuccess(res, doc, 200);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /documents/:id
  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await documentService.deleteDocument(req.params.id as string, req.user!);
      sendSuccess(res, doc, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /documents/:id/download
  async downloadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await documentService.downloadDocument(req.params.id as string, req.user!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new DocumentController();
