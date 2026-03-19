/**
 * Integration tests for the Document / Content Library API.
 *
 * Tests exercise the full request-response cycle through Express,
 * including middleware (authenticate, authorize, validate),
 * the controller, the service, and mocked repositories/database.
 *
 * Coverage:
 *   - Document CRUD by admin
 *   - Tier-filtered reads (partner at lower tier cannot see high-tier doc)
 *   - Download increments count
 *   - RBAC: partner cannot upload/delete
 */

// -- Mocks (before all imports) --

jest.mock('../../src/repositories/document.repository', () => ({
  __esModule: true,
  default: {
    listFolders: jest.fn(),
    findFolderById: jest.fn(),
    createFolder: jest.fn(),
    updateFolder: jest.fn(),
    folderHasDocuments: jest.fn(),
    folderHasChildren: jest.fn(),
    wouldCreateCircle: jest.fn(),
    listDocuments: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    incrementDownloadCount: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
    listNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    deleteNotification: jest.fn(),
  },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockResolvedValue([]),
  first: jest.fn().mockResolvedValue(null),
  join: jest.fn().mockReturnThis(),
  increment: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(),
}));

// -- Imports --

import request from 'supertest';
import jwt from 'jsonwebtoken';
import express, { Application } from 'express';
import documentRouter from '../../src/routes/document.routes';
import documentRepository from '../../src/repositories/document.repository';
import { ORG_IDS, USER_IDS, TIER_IDS } from '../fixtures/factories';
import { v4 as uuidv4 } from 'uuid';

const mockRepo = documentRepository as jest.Mocked<typeof documentRepository>;
const mockJwtVerify = jwt.verify as jest.Mock;

const DOC_ID = uuidv4();
const FOLDER_ID = uuidv4();

// -- App setup --

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/documents', documentRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      data: null,
      errors: err.errors || [{ code: err.code || 'INTERNAL_ERROR', message: err.message }],
      meta: null,
    });
  });
  return app;
}

const app = buildApp();

// -- JWT helpers --

function setupJwtAsAdmin() {
  (mockDb as jest.Mock).mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.admin,
          email: 'admin@example.com',
          role: 'admin',
          organization_id: null,
          is_active: true,
        }),
      };
    }
    return mockDbChain;
  });
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.admin,
    email: 'admin@example.com',
    role: 'admin',
    org_id: null,
    tier_id: null,
  });
}

function setupJwtAsPartnerAdmin(tierId: string = TIER_IDS.registered) {
  (mockDb as jest.Mock).mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.partnerAdminA,
          email: 'partner.admin.a@example.com',
          role: 'partner_admin',
          organization_id: ORG_IDS.orgA,
          is_active: true,
        }),
      };
    }
    if (table === 'organizations') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: ORG_IDS.orgA,
          status: 'active',
          tier_id: tierId,
        }),
      };
    }
    return mockDbChain;
  });
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.partnerAdminA,
    email: 'partner.admin.a@example.com',
    role: 'partner_admin',
    org_id: ORG_IDS.orgA,
    tier_id: tierId,
  });
}

function setupJwtAsPartnerRep() {
  (mockDb as jest.Mock).mockImplementation((table: string) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.partnerRepA,
          email: 'partner.rep.a@example.com',
          role: 'partner_rep',
          organization_id: ORG_IDS.orgA,
          is_active: true,
        }),
      };
    }
    if (table === 'organizations') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: ORG_IDS.orgA,
          status: 'active',
          tier_id: TIER_IDS.registered,
        }),
      };
    }
    return mockDbChain;
  });
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.partnerRepA,
    email: 'partner.rep.a@example.com',
    role: 'partner_rep',
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
  });
}

// -- Shared fixtures --

function makeDocRow(overrides: Record<string, any> = {}) {
  return {
    id: DOC_ID,
    folder_id: FOLDER_ID,
    title: 'Partner Onboarding Guide',
    description: 'Guide for new partners',
    file_url: 'https://s3.example.com/docs/onboarding.pdf',
    file_type: 'application/pdf',
    file_size_bytes: 2048000,
    visible_to_tiers: null,
    internal_only: false,
    is_featured: false,
    version: 1,
    tags: ['onboarding'],
    download_count: 42,
    uploaded_by: USER_IDS.admin,
    folder_name: 'General',
    uploaded_by_name: 'Admin User',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// -- Tests --

describe('Documents Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.mockImplementation(() => mockDbChain);
  });

  // =========================================================================
  // DOCUMENT CRUD BY ADMIN
  // =========================================================================

  describe('Admin Document CRUD', () => {
    it('POST /documents - admin uploads document (201)', async () => {
      setupJwtAsAdmin();
      const doc = makeDocRow();
      mockRepo.create.mockResolvedValue(doc);

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', 'Bearer mock-token')
        .send({
          title: 'Partner Onboarding Guide',
          file_url: 'https://s3.example.com/docs/onboarding.pdf',
          file_type: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Partner Onboarding Guide');
    });

    it('GET /documents - admin lists all documents (200)', async () => {
      setupJwtAsAdmin();
      mockRepo.listDocuments.mockResolvedValue({
        data: [makeDocRow(), makeDocRow({ id: 'doc-uuid-2', title: 'Sales Guide' })],
        total: 2,
      });

      const res = await request(app)
        .get('/api/v1/documents')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('GET /documents/:id - admin gets document detail (200)', async () => {
      setupJwtAsAdmin();
      mockRepo.findById.mockResolvedValue(makeDocRow());

      const res = await request(app)
        .get(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(DOC_ID);
    });

    it('PATCH /documents/:id - admin updates document (200)', async () => {
      setupJwtAsAdmin();
      mockRepo.findById.mockResolvedValue(makeDocRow());
      mockRepo.update.mockResolvedValue({ ...makeDocRow(), title: 'Updated Guide' });

      const res = await request(app)
        .patch(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .send({ title: 'Updated Guide' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Guide');
    });

    it('DELETE /documents/:id - admin deletes document (200)', async () => {
      setupJwtAsAdmin();
      mockRepo.findById.mockResolvedValue(makeDocRow());
      mockRepo.delete.mockResolvedValue(makeDocRow());

      const res = await request(app)
        .delete(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // TIER-FILTERED READS
  // =========================================================================

  describe('Tier-Filtered Access', () => {
    it('partner at lower tier cannot see high-tier document (404 opaque)', async () => {
      setupJwtAsPartnerAdmin(TIER_IDS.registered);

      // Repository returns null because tier filter excludes the document
      mockRepo.findById.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(404);
      // Should be opaque 404, not 403
      expect(res.body.errors[0].code).toBe('NOT_FOUND');
    });

    it('partner at correct tier can see the document (200)', async () => {
      setupJwtAsPartnerAdmin(TIER_IDS.platinum);
      const doc = makeDocRow({ visible_to_tiers: [TIER_IDS.platinum] });
      mockRepo.findById.mockResolvedValue(doc);

      const res = await request(app)
        .get(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(DOC_ID);
    });

    it('admin bypasses tier filtering and sees internal-only docs (200)', async () => {
      setupJwtAsAdmin();
      const doc = makeDocRow({ internal_only: true, visible_to_tiers: [TIER_IDS.diamond] });
      mockRepo.findById.mockResolvedValue(doc);

      const res = await request(app)
        .get(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data.internal_only).toBe(true);
    });

    it('partner list endpoint respects tier filtering', async () => {
      setupJwtAsPartnerAdmin(TIER_IDS.registered);
      // Only shows docs visible to registered tier
      mockRepo.listDocuments.mockResolvedValue({
        data: [makeDocRow({ visible_to_tiers: null })],
        total: 1,
      });

      const res = await request(app)
        .get('/api/v1/documents')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      // Verify the service passes correct tier visibility options
      const callArgs = mockRepo.listDocuments.mock.calls[0];
      expect(callArgs[1]).toEqual(
        expect.objectContaining({ isInternal: false, tierId: TIER_IDS.registered }),
      );
    });
  });

  // =========================================================================
  // DOWNLOAD
  // =========================================================================

  describe('Download', () => {
    it('GET /documents/:id/download - increments count and returns download info', async () => {
      setupJwtAsPartnerAdmin();
      const doc = makeDocRow();
      mockRepo.findById.mockResolvedValue(doc);
      mockRepo.incrementDownloadCount.mockResolvedValue(undefined);

      const res = await request(app)
        .get(`/api/v1/documents/${DOC_ID}/download`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data.download_url).toBe(doc.file_url);
      expect(res.body.data.filename).toBe(doc.title);
      expect(res.body.data.expires_in_seconds).toBe(300);
      expect(mockRepo.incrementDownloadCount).toHaveBeenCalledWith(DOC_ID);
    });

    it('download for non-visible doc returns 404', async () => {
      setupJwtAsPartnerAdmin();
      mockRepo.findById.mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/documents/${DOC_ID}/download`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(404);
      expect(mockRepo.incrementDownloadCount).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // RBAC ENFORCEMENT
  // =========================================================================

  describe('RBAC', () => {
    it('partner_admin cannot upload documents (403)', async () => {
      setupJwtAsPartnerAdmin();

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', 'Bearer mock-token')
        .send({
          title: 'Forbidden Doc',
          file_url: 'https://s3.example.com/forbidden.pdf',
        });

      expect(res.status).toBe(403);
      expect(res.body.errors[0].code).toBe('AUTH_INSUFFICIENT_ROLE');
    });

    it('partner_rep cannot upload documents (403)', async () => {
      setupJwtAsPartnerRep();

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', 'Bearer mock-token')
        .send({
          title: 'Forbidden Doc',
          file_url: 'https://s3.example.com/forbidden.pdf',
        });

      expect(res.status).toBe(403);
    });

    it('partner_admin cannot delete documents (403)', async () => {
      setupJwtAsPartnerAdmin();

      const res = await request(app)
        .delete(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(403);
    });

    it('partner_rep cannot delete documents (403)', async () => {
      setupJwtAsPartnerRep();

      const res = await request(app)
        .delete(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(403);
    });

    it('partner_admin cannot update documents (403)', async () => {
      setupJwtAsPartnerAdmin();

      const res = await request(app)
        .patch(`/api/v1/documents/${DOC_ID}`)
        .set('Authorization', 'Bearer mock-token')
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);
    });

    it('partner_admin cannot create folders (403)', async () => {
      setupJwtAsPartnerAdmin();

      const res = await request(app)
        .post('/api/v1/documents/folders')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: 'Forbidden Folder' });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // FOLDER OPERATIONS
  // =========================================================================

  describe('Folders', () => {
    it('GET /documents/folders - list folders (200)', async () => {
      setupJwtAsPartnerAdmin();
      mockRepo.listFolders.mockResolvedValue([
        { id: 'f1', name: 'General', parent_id: null },
      ]);

      const res = await request(app)
        .get('/api/v1/documents/folders')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('POST /documents/folders - admin creates folder (201)', async () => {
      setupJwtAsAdmin();
      mockRepo.createFolder.mockResolvedValue({
        id: 'new-folder',
        name: 'Training Materials',
        parent_id: null,
      });

      const res = await request(app)
        .post('/api/v1/documents/folders')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: 'Training Materials' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Training Materials');
    });
  });

  // =========================================================================
  // VALIDATION
  // =========================================================================

  describe('Validation', () => {
    it('rejects document upload without required title (422)', async () => {
      setupJwtAsAdmin();

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', 'Bearer mock-token')
        .send({ file_url: 'https://example.com/file.pdf' }); // missing title

      expect(res.status).toBe(422);
    });

    it('rejects document upload without required file_url (422)', async () => {
      setupJwtAsAdmin();

      const res = await request(app)
        .post('/api/v1/documents')
        .set('Authorization', 'Bearer mock-token')
        .send({ title: 'Doc without URL' }); // missing file_url

      expect(res.status).toBe(422);
    });

    it('rejects invalid UUID in document param (422)', async () => {
      setupJwtAsAdmin();

      const res = await request(app)
        .get('/api/v1/documents/not-a-uuid')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(422);
    });
  });

  // =========================================================================
  // AUTH REQUIRED
  // =========================================================================

  describe('Authentication', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(app).get('/api/v1/documents');

      expect(res.status).toBe(401);
    });
  });
});
