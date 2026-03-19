import documentRepository, { DocumentFilters } from '../repositories/document.repository';
import notificationService from './notification.service';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../types/express';
import { INTERNAL_ROLES } from '../config/constants';
import db from '../config/database';

class DocumentService {
  // ═══════════════════════════════════════════════════════════════════════
  // FOLDERS
  // ═══════════════════════════════════════════════════════════════════════

  async listFolders(user: JwtPayload) {
    const isInternal = INTERNAL_ROLES.includes(user.role as any);
    return documentRepository.listFolders({
      isInternal,
      tierId: user.tier_id,
    });
  }

  async createFolder(data: Record<string, any>, _user: JwtPayload) {
    // Validate parent_id exists if provided
    if (data.parent_id) {
      const parent = await documentRepository.findFolderById(data.parent_id);
      if (!parent) {
        throw AppError.notFound('Parent folder not found', 'NOT_FOUND');
      }
    }

    // Validate visible_to_tiers UUIDs
    if (data.visible_to_tiers && data.visible_to_tiers.length > 0) {
      const tiers = await db('partner_tiers').whereIn('id', data.visible_to_tiers).select('id');
      if (tiers.length !== data.visible_to_tiers.length) {
        throw AppError.validation('One or more tier IDs are invalid', 'visible_to_tiers');
      }
    }

    return documentRepository.createFolder({
      name: data.name,
      parent_id: data.parent_id || null,
      visible_to_tiers: data.visible_to_tiers || null,
      internal_only: data.internal_only || false,
      sort_order: data.sort_order || 0,
    });
  }

  async updateFolder(id: string, data: Record<string, any>, _user: JwtPayload) {
    const folder = await documentRepository.findFolderById(id);
    if (!folder) {
      throw AppError.notFound('Folder not found', 'NOT_FOUND');
    }

    // Check for circular reference if parent_id is changing
    if (data.parent_id !== undefined && data.parent_id !== folder.parent_id) {
      if (data.parent_id) {
        const wouldCircle = await documentRepository.wouldCreateCircle(id, data.parent_id);
        if (wouldCircle) {
          throw new AppError(
            'Cannot set parent: would create a circular folder reference',
            422,
            'CIRCULAR_FOLDER_REFERENCE',
          );
        }
      }
    }

    if (data.visible_to_tiers && data.visible_to_tiers.length > 0) {
      const tiers = await db('partner_tiers').whereIn('id', data.visible_to_tiers).select('id');
      if (tiers.length !== data.visible_to_tiers.length) {
        throw AppError.validation('One or more tier IDs are invalid', 'visible_to_tiers');
      }
    }

    const allowed = ['name', 'parent_id', 'visible_to_tiers', 'internal_only', 'sort_order'];
    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    if (Object.keys(updates).length === 0) {
      return folder;
    }

    return documentRepository.updateFolder(id, updates);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════

  async listDocuments(
    filters: DocumentFilters,
    user: JwtPayload,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    const isInternal = INTERNAL_ROLES.includes(user.role as any);
    return documentRepository.listDocuments(
      filters,
      { isInternal, tierId: user.tier_id },
      pagination,
      sort,
    );
  }

  async getDocument(id: string, user: JwtPayload) {
    const isInternal = INTERNAL_ROLES.includes(user.role as any);
    const doc = await documentRepository.findById(id, { isInternal, tierId: user.tier_id });

    // Return 404 (not 403) if not visible — opaque denial
    if (!doc) {
      throw AppError.notFound('Document not found', 'NOT_FOUND');
    }

    return doc;
  }

  async uploadDocument(data: Record<string, any>, user: JwtPayload) {
    // Validate folder_id if provided
    if (data.folder_id) {
      const folder = await documentRepository.findFolderById(data.folder_id);
      if (!folder) {
        throw AppError.notFound('Folder not found', 'NOT_FOUND');
      }
    }

    // Validate visible_to_tiers
    if (data.visible_to_tiers && data.visible_to_tiers.length > 0) {
      const tiers = await db('partner_tiers').whereIn('id', data.visible_to_tiers).select('id');
      if (tiers.length !== data.visible_to_tiers.length) {
        throw AppError.validation('One or more tier IDs are invalid', 'visible_to_tiers');
      }
    }

    const docData: Record<string, any> = {
      folder_id: data.folder_id || null,
      title: data.title,
      description: data.description || null,
      file_url: data.file_url,
      file_type: data.file_type || null,
      file_size_bytes: data.file_size_bytes || null,
      visible_to_tiers: data.visible_to_tiers || null,
      internal_only: data.internal_only || false,
      is_featured: data.is_featured || false,
      tags: data.tags || null,
      uploaded_by: user.sub,
    };

    const doc = await documentRepository.create(docData);

    // Send notifications if requested
    if (data.notify_partners) {
      this.notifyPartners(doc).catch((err) => {
        console.error('[DocumentService] Failed to send document notifications:', err.message);
      });
    }

    return doc;
  }

  async updateDocument(id: string, data: Record<string, any>, user: JwtPayload) {
    // Use raw findById without tier filter (admin/CM always has access)
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound('Document not found', 'NOT_FOUND');
    }

    if (data.visible_to_tiers && data.visible_to_tiers.length > 0) {
      const tiers = await db('partner_tiers').whereIn('id', data.visible_to_tiers).select('id');
      if (tiers.length !== data.visible_to_tiers.length) {
        throw AppError.validation('One or more tier IDs are invalid', 'visible_to_tiers');
      }
    }

    // Exclude non-updatable fields
    const allowed = [
      'title', 'description', 'folder_id', 'visible_to_tiers',
      'internal_only', 'is_featured', 'tags', 'version',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    if (Object.keys(updates).length === 0) {
      return doc;
    }

    return documentRepository.update(id, updates);
  }

  async deleteDocument(id: string, _user: JwtPayload) {
    const doc = await documentRepository.findById(id);
    if (!doc) {
      throw AppError.notFound('Document not found', 'NOT_FOUND');
    }

    return documentRepository.delete(id);
  }

  async downloadDocument(id: string, user: JwtPayload) {
    const isInternal = INTERNAL_ROLES.includes(user.role as any);
    const doc = await documentRepository.findById(id, { isInternal, tierId: user.tier_id });

    if (!doc) {
      throw AppError.notFound('Document not found', 'NOT_FOUND');
    }

    // Increment download count atomically
    await documentRepository.incrementDownloadCount(id);

    return {
      download_url: doc.file_url,
      filename: doc.title,
      file_type: doc.file_type,
      file_size_bytes: doc.file_size_bytes,
      expires_in_seconds: 300,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async notifyPartners(doc: Record<string, any>) {
    // Find all partner_admin users at eligible tiers
    let query = db('users')
      .where('role', 'partner_admin')
      .where('is_active', true);

    if (doc.visible_to_tiers && doc.visible_to_tiers.length > 0) {
      query = query
        .join('organizations as o', 'users.organization_id', 'o.id')
        .whereIn('o.tier_id', doc.visible_to_tiers);
    }

    const admins = await query.select('users.id');

    for (const admin of admins) {
      await notificationService.createNotification({
        user_id: admin.id,
        type: 'document_shared',
        title: `New document: ${doc.title}`,
        body: doc.description || 'A new document has been shared with your organization.',
        entity_type: 'document',
        entity_id: doc.id,
        action_url: `/content/documents/${doc.id}`,
      });
    }
  }
}

export default new DocumentService();
