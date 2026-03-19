import db from '../config/database';
import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';

export class ProductRepository {
  async findById(id: string) {
    return db('products')
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .select(
        'products.*',
        'product_categories.name as category_name',
      )
      .where('products.id', id)
      .first();
  }

  async findBySku(sku: string) {
    return db('products').where('sku', sku).first();
  }

  async list(
    filters: {
      category_id?: string;
      product_type?: string;
      is_active?: string;
      search?: string;
    },
    pagination: { offset: number; limit: number },
    sort: string | undefined,
    isPartner: boolean,
  ) {
    let query = db('products')
      .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
      .select(
        'products.*',
        'product_categories.name as category_name',
      );
    let countQuery = db('products').count('* as total');

    // Partners only see active + available products
    if (isPartner) {
      query = query.where('products.is_active', true).where('products.available_to_partners', true);
      countQuery = countQuery.where('is_active', true).where('available_to_partners', true);
    }

    if (filters.category_id) {
      query = query.where('products.category_id', filters.category_id);
      countQuery = countQuery.where('category_id', filters.category_id);
    }
    if (filters.product_type) {
      query = query.where('products.product_type', filters.product_type);
      countQuery = countQuery.where('product_type', filters.product_type);
    }
    if (filters.is_active !== undefined && !isPartner) {
      const active = filters.is_active === 'true';
      query = query.where('products.is_active', active);
      countQuery = countQuery.where('is_active', active);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      const searchFn = function (this: Knex.QueryBuilder) {
        this.where('products.name', 'ilike', term)
          .orWhere('products.sku', 'ilike', term);
      };
      query = query.where(searchFn);
      countQuery = countQuery.where(function (this: Knex.QueryBuilder) {
        this.where('name', 'ilike', term).orWhere('sku', 'ilike', term);
      });
    }

    // Sort
    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['name', 'sku', 'list_price', 'created_at', 'product_type'];
      if (allowed.includes(col)) {
        query = query.orderBy(`products.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('products.name', 'asc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    // Shape category
    const shaped = data.map((row: any) => {
      const { category_name, ...rest } = row;
      if (category_name) {
        rest.category = { id: rest.category_id, name: category_name };
      }
      return rest;
    });

    return { data: shaped, total };
  }

  async create(data: Record<string, any>) {
    const [product] = await db('products')
      .insert({ id: uuidv4(), ...data })
      .returning('*');
    return product;
  }

  async update(id: string, data: Record<string, any>) {
    const [product] = await db('products')
      .where('id', id)
      .update(data)
      .returning('*');
    return product;
  }

  // ===== Categories =====

  async listCategories() {
    return db('product_categories').orderBy('sort_order', 'asc');
  }

  async findCategoryById(id: string) {
    return db('product_categories').where('id', id).first();
  }

  async createCategory(data: Record<string, any>) {
    const [category] = await db('product_categories')
      .insert({ id: uuidv4(), ...data })
      .returning('*');
    return category;
  }

  async updateCategory(id: string, data: Record<string, any>) {
    const [category] = await db('product_categories')
      .where('id', id)
      .update(data)
      .returning('*');
    return category;
  }

  // ===== Tier Pricing =====

  async getTierPricing(productId: string) {
    return db('tier_product_pricing')
      .join('partner_tiers', 'tier_product_pricing.tier_id', 'partner_tiers.id')
      .where('tier_product_pricing.product_id', productId)
      .select(
        'tier_product_pricing.*',
        'partner_tiers.name as tier_name',
        'partner_tiers.rank as tier_rank',
      )
      .orderBy('partner_tiers.rank', 'asc');
  }

  async getTierPricingForTier(productId: string, tierId: string) {
    return db('tier_product_pricing')
      .where('product_id', productId)
      .where('tier_id', tierId)
      .first();
  }

  async upsertTierPricing(productId: string, tierId: string, data: { discount_pct?: number; special_price?: number }) {
    const existing = await this.getTierPricingForTier(productId, tierId);

    if (existing) {
      const [updated] = await db('tier_product_pricing')
        .where('id', existing.id)
        .update(data)
        .returning('*');
      return updated;
    }

    const [created] = await db('tier_product_pricing')
      .insert({
        id: uuidv4(),
        product_id: productId,
        tier_id: tierId,
        ...data,
      })
      .returning('*');
    return created;
  }
}

export default new ProductRepository();
