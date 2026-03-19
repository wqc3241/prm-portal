/**
 * Unit tests for DocumentService.
 *
 * All external dependencies (documentRepository, notificationService, db)
 * are fully mocked. No database or network connections required.
 *
 * Coverage: Document CRUD, tier visibility filtering, download counting,
 * folder CRUD with circular reference check, admin bypass.
 */

// -- Mocks must be declared before any imports --

jest.mock('../../../src/repositories/document.repository', () => ({
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

jest.mock('../../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  first: jest.fn(),
  join: jest.fn().mockReturnThis(),
  increment: jest.fn().mockReturnThis(),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// -- Imports --

import documentService from '../../../src/services/document.service';
import documentRepository from '../../../src/repositories/document.repository';
import { AppError } from '../../../src/utils/AppError';
import {
  USER_IDS,
  ORG_IDS,
  TIER_IDS,
  adminPayload,
  partnerAdminPayload,
  cmPayload,
} from '../../fixtures/factories';

const mockRepo = documentRepository as jest.Mocked<typeof documentRepository>;

// -- Helpers --

function makeDoc(overrides: Record<string, any> = {}) {
  return {
    id: 'doc-uuid-1',
    folder_id: 'folder-uuid-1',
    title: 'Partner Onboarding Guide',
    description: 'Guide for new partners',
    file_url: 'https://s3.example.com/docs/onboarding.pdf',
    file_type: 'application/pdf',
    file_size_bytes: 2048000,
    visible_to_tiers: null,
    internal_only: false,
    is_featured: false,
    version: 1,
    tags: ['onboarding', 'guide'],
    download_count: 42,
    uploaded_by: USER_IDS.admin,
    folder_name: 'General',
    uploaded_by_name: 'Admin User',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeFolder(overrides: Record<string, any> = {}) {
  return {
    id: 'folder-uuid-1',
    name: 'General',
    parent_id: null,
    visible_to_tiers: null,
    internal_only: false,
    sort_order: 0,
    created_at: new Date(),
    ...overrides,
  };
}

// -- Tests --

describe('DocumentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // FOLDERS
  // =========================================================================

  describe('listFolders', () => {
    it('should pass isInternal=true for admin users', async () => {
      mockRepo.listFolders.mockResolvedValue([makeFolder()]);

      await documentService.listFolders(adminPayload() as any);

      expect(mockRepo.listFolders).toHaveBeenCalledWith({
        isInternal: true,
        tierId: null,
      });
    });

    it('should pass isInternal=false and tierId for partner users', async () => {
      mockRepo.listFolders.mockResolvedValue([makeFolder()]);

      await documentService.listFolders(partnerAdminPayload() as any);

      expect(mockRepo.listFolders).toHaveBeenCalledWith({
        isInternal: false,
        tierId: TIER_IDS.registered,
      });
    });
  });

  describe('createFolder', () => {
    it('should create folder with valid data', async () => {
      const folder = makeFolder();
      mockRepo.createFolder.mockResolvedValue(folder);

      const result = await documentService.createFolder(
        { name: 'General' },
        adminPayload() as any,
      );

      expect(mockRepo.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'General',
          parent_id: null,
          internal_only: false,
        }),
      );
    });

    it('should validate parent_id exists', async () => {
      mockRepo.findFolderById.mockResolvedValue(null);

      await expect(
        documentService.createFolder(
          { name: 'Sub', parent_id: 'nonexistent' },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should validate visible_to_tiers UUIDs', async () => {
      // Return only 1 tier when 2 were requested
      mockDbChain.select.mockResolvedValueOnce([{ id: TIER_IDS.registered }]);

      await expect(
        documentService.createFolder(
          { name: 'Tier Folder', visible_to_tiers: [TIER_IDS.registered, 'bad-tier-id'] },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  describe('updateFolder', () => {
    it('should update folder name', async () => {
      const folder = makeFolder();
      mockRepo.findFolderById.mockResolvedValue(folder);
      mockRepo.updateFolder.mockResolvedValue({ ...folder, name: 'Updated' });

      const result = await documentService.updateFolder(
        'folder-uuid-1',
        { name: 'Updated' },
        adminPayload() as any,
      );

      expect(mockRepo.updateFolder).toHaveBeenCalledWith('folder-uuid-1', { name: 'Updated' });
    });

    it('should throw NOT_FOUND for nonexistent folder', async () => {
      mockRepo.findFolderById.mockResolvedValue(null);

      await expect(
        documentService.updateFolder('bad-id', { name: 'X' }, adminPayload() as any),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should check for circular reference when changing parent_id', async () => {
      const folder = makeFolder({ parent_id: null });
      mockRepo.findFolderById.mockResolvedValue(folder);
      mockRepo.wouldCreateCircle.mockResolvedValue(true);

      await expect(
        documentService.updateFolder(
          'folder-uuid-1',
          { parent_id: 'child-folder-id' },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'CIRCULAR_FOLDER_REFERENCE',
      });
    });

    it('should allow parent_id change when no circular reference', async () => {
      const folder = makeFolder({ parent_id: null });
      mockRepo.findFolderById.mockResolvedValue(folder);
      mockRepo.wouldCreateCircle.mockResolvedValue(false);
      mockRepo.updateFolder.mockResolvedValue({ ...folder, parent_id: 'other-folder' });

      const result = await documentService.updateFolder(
        'folder-uuid-1',
        { parent_id: 'other-folder' },
        adminPayload() as any,
      );

      expect(mockRepo.updateFolder).toHaveBeenCalled();
    });

    it('should skip circular check when parent_id not changing', async () => {
      const folder = makeFolder({ parent_id: 'existing-parent' });
      mockRepo.findFolderById.mockResolvedValue(folder);
      mockRepo.updateFolder.mockResolvedValue({ ...folder, name: 'New Name' });

      await documentService.updateFolder(
        'folder-uuid-1',
        { parent_id: 'existing-parent', name: 'New Name' },
        adminPayload() as any,
      );

      expect(mockRepo.wouldCreateCircle).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // DOCUMENTS
  // =========================================================================

  describe('listDocuments', () => {
    it('should pass tier visibility options for partner users', async () => {
      mockRepo.listDocuments.mockResolvedValue({ data: [], total: 0 });

      await documentService.listDocuments(
        {},
        partnerAdminPayload() as any,
        { offset: 0, limit: 25 },
      );

      expect(mockRepo.listDocuments).toHaveBeenCalledWith(
        {},
        { isInternal: false, tierId: TIER_IDS.registered },
        { offset: 0, limit: 25 },
        undefined,
      );
    });

    it('should pass isInternal=true for admin', async () => {
      mockRepo.listDocuments.mockResolvedValue({ data: [], total: 0 });

      await documentService.listDocuments({}, adminPayload() as any, { offset: 0, limit: 25 });

      expect(mockRepo.listDocuments).toHaveBeenCalledWith(
        {},
        { isInternal: true, tierId: null },
        { offset: 0, limit: 25 },
        undefined,
      );
    });
  });

  describe('getDocument', () => {
    it('should return document when partner has sufficient tier', async () => {
      const doc = makeDoc({ visible_to_tiers: null }); // null = visible to all
      mockRepo.findById.mockResolvedValue(doc);

      const result = await documentService.getDocument('doc-uuid-1', partnerAdminPayload() as any);

      expect(result.id).toBe('doc-uuid-1');
    });

    it('should return 404 (opaque) when partner tier is insufficient', async () => {
      mockRepo.findById.mockResolvedValue(null); // repo filters by tier

      await expect(
        documentService.getDocument('doc-uuid-1', partnerAdminPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('should return document for admin regardless of tier visibility', async () => {
      const doc = makeDoc({ visible_to_tiers: [TIER_IDS.diamond], internal_only: true });
      mockRepo.findById.mockResolvedValue(doc);

      const result = await documentService.getDocument('doc-uuid-1', adminPayload() as any);

      // Admin passes isInternal=true which bypasses all visibility checks
      expect(result.id).toBe('doc-uuid-1');
    });

    it('should throw 404 for nonexistent document', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        documentService.getDocument('nonexistent', adminPayload() as any),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('uploadDocument', () => {
    it('should create document with user as uploader', async () => {
      const doc = makeDoc();
      mockRepo.create.mockResolvedValue(doc);

      const result = await documentService.uploadDocument(
        {
          title: 'Partner Guide',
          file_url: 'https://s3.example.com/guide.pdf',
          file_type: 'application/pdf',
        },
        adminPayload() as any,
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Partner Guide',
          uploaded_by: USER_IDS.admin,
        }),
      );
    });

    it('should validate folder_id if provided', async () => {
      mockRepo.findFolderById.mockResolvedValue(null);

      await expect(
        documentService.uploadDocument(
          { title: 'X', file_url: 'url', folder_id: 'bad-id' },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should validate visible_to_tiers UUIDs', async () => {
      mockDbChain.select.mockResolvedValueOnce([{ id: TIER_IDS.registered }]);

      await expect(
        documentService.uploadDocument(
          {
            title: 'X',
            file_url: 'url',
            visible_to_tiers: [TIER_IDS.registered, 'bad-id'],
          },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  describe('updateDocument', () => {
    it('should update allowed fields', async () => {
      const doc = makeDoc();
      mockRepo.findById.mockResolvedValue(doc);
      mockRepo.update.mockResolvedValue({ ...doc, title: 'Updated Title' });

      const result = await documentService.updateDocument(
        'doc-uuid-1',
        { title: 'Updated Title' },
        adminPayload() as any,
      );

      expect(mockRepo.update).toHaveBeenCalledWith('doc-uuid-1', { title: 'Updated Title' });
    });

    it('should throw 404 for nonexistent document', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        documentService.updateDocument('bad-id', { title: 'X' }, adminPayload() as any),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should return unchanged doc when no allowed fields provided', async () => {
      const doc = makeDoc();
      mockRepo.findById.mockResolvedValue(doc);

      const result = await documentService.updateDocument(
        'doc-uuid-1',
        { not_allowed: 'value' },
        adminPayload() as any,
      );

      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(result.id).toBe(doc.id);
    });
  });

  describe('deleteDocument', () => {
    it('should delete existing document', async () => {
      const doc = makeDoc();
      mockRepo.findById.mockResolvedValue(doc);
      mockRepo.delete.mockResolvedValue(doc);

      const result = await documentService.deleteDocument('doc-uuid-1', adminPayload() as any);

      expect(mockRepo.delete).toHaveBeenCalledWith('doc-uuid-1');
    });

    it('should throw 404 for nonexistent document', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        documentService.deleteDocument('bad-id', adminPayload() as any),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('downloadDocument', () => {
    it('should increment download count and return download info', async () => {
      const doc = makeDoc();
      mockRepo.findById.mockResolvedValue(doc);
      mockRepo.incrementDownloadCount.mockResolvedValue(undefined);

      const result = await documentService.downloadDocument(
        'doc-uuid-1',
        partnerAdminPayload() as any,
      );

      expect(mockRepo.incrementDownloadCount).toHaveBeenCalledWith('doc-uuid-1');
      expect(result).toEqual(
        expect.objectContaining({
          download_url: doc.file_url,
          filename: doc.title,
          file_type: doc.file_type,
          expires_in_seconds: 300,
        }),
      );
    });

    it('should return 404 when doc not visible to partner tier', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        documentService.downloadDocument('doc-uuid-1', partnerAdminPayload() as any),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(mockRepo.incrementDownloadCount).not.toHaveBeenCalled();
    });
  });
});
