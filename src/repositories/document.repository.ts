import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface DocumentFilters {
  folder_id?: string;
  file_type?: string;
  tags?: string;
  search?: string;
  is_featured?: boolean;
  internal_only?: boolean;
}

export class DocumentRepository {
  // ═══════════════════════════════════════════════════════════════════════
  // FOLDERS
  // ═══════════════════════════════════════════════════════════════════════

  async listFolders(options: { isInternal: boolean; tierId: string | null }) {
    let query = db('document_folders')
      .select('*')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc');

    if (!options.isInternal) {
      query = query.where('internal_only', false);

      if (options.tierId) {
        query = query.where(function () {
          this.whereNull('visible_to_tiers')
            .orWhereRaw('visible_to_tiers @> ARRAY[?]::uuid[]', [options.tierId]);
        });
      } else {
        query = query.whereNull('visible_to_tiers');
      }
    }

    return query;
  }

  async findFolderById(id: string) {
    return db('document_folders').where('id', id).first();
  }

  async createFolder(data: Record<string, any>) {
    const id = uuidv4();
    const [folder] = await db('document_folders')
      .insert({ id, ...data })
      .returning('*');
    return folder;
  }

  async updateFolder(id: string, data: Record<string, any>) {
    const [updated] = await db('document_folders')
      .where('id', id)
      .update(data)
      .returning('*');
    return updated || null;
  }

  async folderHasDocuments(folderId: string): Promise<boolean> {
    const [result] = await db('documents')
      .where('folder_id', folderId)
      .count('* as total');
    return parseInt(result.total as string, 10) > 0;
  }

  async folderHasChildren(folderId: string): Promise<boolean> {
    const [result] = await db('document_folders')
      .where('parent_id', folderId)
      .count('* as total');
    return parseInt(result.total as string, 10) > 0;
  }

  /**
   * Check if setting parentId on folderId would create a circular reference.
   */
  async wouldCreateCircle(folderId: string, newParentId: string): Promise<boolean> {
    if (folderId === newParentId) return true;

    // Walk up the tree from newParentId
    let current = newParentId;
    const visited = new Set<string>();

    while (current) {
      if (current === folderId) return true;
      if (visited.has(current)) return false; // cycle already exists (shouldn't happen)
      visited.add(current);

      const parent = await db('document_folders')
        .where('id', current)
        .select('parent_id')
        .first();

      if (!parent || !parent.parent_id) break;
      current = parent.parent_id;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════════════════

  async listDocuments(
    filters: DocumentFilters,
    options: { isInternal: boolean; tierId: string | null },
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('documents as d')
      .leftJoin('document_folders as f', 'd.folder_id', 'f.id')
      .leftJoin('users as u', 'd.uploaded_by', 'u.id')
      .select(
        'd.*',
        'f.name as folder_name',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name"),
      );

    let countQuery = db('documents as d')
      .leftJoin('document_folders as f', 'd.folder_id', 'f.id')
      .count('* as total');

    // Tier/internal visibility filtering
    const applyVisibility = (q: any) => {
      if (!options.isInternal) {
        // Exclude internal-only documents
        q = q.where('d.internal_only', false);
        // Exclude documents in internal-only folders
        q = q.where(function () {
          this.whereNull('d.folder_id')
            .orWhere('f.internal_only', false);
        });

        if (options.tierId) {
          // Document tier visibility
          q = q.where(function () {
            this.whereNull('d.visible_to_tiers')
              .orWhereRaw('d.visible_to_tiers @> ARRAY[?]::uuid[]', [options.tierId]);
          });
          // Folder tier visibility
          q = q.where(function () {
            this.whereNull('d.folder_id')
              .orWhereNull('f.visible_to_tiers')
              .orWhereRaw('f.visible_to_tiers @> ARRAY[?]::uuid[]', [options.tierId]);
          });
        } else {
          // User has no tier — only see docs with null visible_to_tiers
          q = q.whereNull('d.visible_to_tiers');
          q = q.where(function () {
            this.whereNull('d.folder_id')
              .orWhereNull('f.visible_to_tiers');
          });
        }
      }
      return q;
    };

    query = applyVisibility(query);
    countQuery = applyVisibility(countQuery);

    // Apply content filters
    const applyFilters = (q: any) => {
      if (filters.folder_id) {
        q = q.where('d.folder_id', filters.folder_id);
      }
      if (filters.file_type) {
        q = q.where('d.file_type', filters.file_type);
      }
      if (filters.tags) {
        const tagArray = filters.tags.split(',').map((t) => t.trim());
        q = q.whereRaw('d.tags && ?::text[]', ['{' + tagArray.join(',') + '}']);
      }
      if (filters.search) {
        q = q.where(function () {
          this.where('d.title', 'ilike', `%${filters.search}%`)
            .orWhere('d.description', 'ilike', `%${filters.search}%`);
        });
      }
      if (filters.is_featured !== undefined) {
        q = q.where('d.is_featured', filters.is_featured);
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['created_at', 'title', 'download_count', 'file_type', 'updated_at'];
      if (allowed.includes(col)) {
        query = query.orderBy(`d.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('d.created_at', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  async findById(id: string, options?: { isInternal: boolean; tierId: string | null }) {
    let query = db('documents as d')
      .leftJoin('document_folders as f', 'd.folder_id', 'f.id')
      .leftJoin('users as u', 'd.uploaded_by', 'u.id')
      .select(
        'd.*',
        'f.name as folder_name',
        'f.internal_only as folder_internal_only',
        'f.visible_to_tiers as folder_visible_to_tiers',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name"),
      )
      .where('d.id', id);

    const doc = await query.first();
    if (!doc) return null;

    // Apply visibility check if options provided (partner users)
    if (options && !options.isInternal) {
      // Check internal_only
      if (doc.internal_only) return null;
      if (doc.folder_internal_only) return null;

      // Check document tier visibility
      if (doc.visible_to_tiers) {
        if (!options.tierId || !doc.visible_to_tiers.includes(options.tierId)) {
          return null;
        }
      }

      // Check folder tier visibility
      if (doc.folder_visible_to_tiers) {
        if (!options.tierId || !doc.folder_visible_to_tiers.includes(options.tierId)) {
          return null;
        }
      }
    }

    return doc;
  }

  async create(data: Record<string, any>) {
    const id = uuidv4();
    const [doc] = await db('documents')
      .insert({ id, ...data })
      .returning('*');
    return doc;
  }

  async update(id: string, data: Record<string, any>) {
    const [updated] = await db('documents')
      .where('id', id)
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return updated || null;
  }

  async delete(id: string) {
    const [deleted] = await db('documents')
      .where('id', id)
      .delete()
      .returning('*');
    return deleted || null;
  }

  async incrementDownloadCount(id: string) {
    await db('documents')
      .where('id', id)
      .increment('download_count', 1);
  }
}

export default new DocumentRepository();
