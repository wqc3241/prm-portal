import { Router } from 'express';
import documentController from '../controllers/document.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  documentIdParamSchema,
  folderIdParamSchema,
  createFolderSchema,
  updateFolderSchema,
  uploadDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
} from '../validators/document.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════
// FOLDER ROUTES (static paths first)
// ═══════════════════════════════════════════════════════════════════════

// GET /documents/folders — list folders (tier-filtered)
router.get(
  '/folders',
  documentController.listFolders,
);

// POST /documents/folders — create folder (admin, channel_manager)
router.post(
  '/folders',
  authorize('admin', 'channel_manager'),
  validate(createFolderSchema),
  documentController.createFolder,
);

// PATCH /documents/folders/:id — update folder (admin, channel_manager)
router.patch(
  '/folders/:id',
  authorize('admin', 'channel_manager'),
  validate(folderIdParamSchema, 'params'),
  validate(updateFolderSchema),
  documentController.updateFolder,
);

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════

// GET /documents — list documents (tier-filtered)
router.get(
  '/',
  validate(listDocumentsQuerySchema, 'query'),
  documentController.listDocuments,
);

// POST /documents — upload document (admin, channel_manager)
router.post(
  '/',
  authorize('admin', 'channel_manager'),
  validate(uploadDocumentSchema),
  documentController.uploadDocument,
);

// GET /documents/:id — get document detail (tier-filtered)
router.get(
  '/:id',
  validate(documentIdParamSchema, 'params'),
  documentController.getDocument,
);

// PATCH /documents/:id — update document (admin, channel_manager)
router.patch(
  '/:id',
  authorize('admin', 'channel_manager'),
  validate(documentIdParamSchema, 'params'),
  validate(updateDocumentSchema),
  documentController.updateDocument,
);

// DELETE /documents/:id — delete document (admin only)
router.delete(
  '/:id',
  authorize('admin'),
  validate(documentIdParamSchema, 'params'),
  documentController.deleteDocument,
);

// GET /documents/:id/download — download document (tier-filtered)
router.get(
  '/:id/download',
  validate(documentIdParamSchema, 'params'),
  documentController.downloadDocument,
);

export default router;
