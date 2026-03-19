import productRepository from '../repositories/product.repository';
import tierRepository from '../repositories/tier.repository';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../types/express';
import { PARTNER_ROLES } from '../config/constants';
import db from '../config/database';

class ProductService {
  async list(
    filters: {
      category_id?: string;
      product_type?: string;
      is_active?: string;
      search?: string;
    },
    pagination: { offset: number; limit: number },
    sort: string | undefined,
    requestor: JwtPayload,
  ) {
    const isPartner = PARTNER_ROLES.includes(requestor.role as any);
    return productRepository.list(filters, pagination, sort, isPartner);
  }

  async getById(id: string, requestor: JwtPayload) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    // Shape category
    const { category_name, ...rest } = product;
    if (category_name) {
      rest.category = { id: rest.category_id, name: category_name };
    }

    // Get tier pricing
    const isPartner = PARTNER_ROLES.includes(requestor.role as any);
    if (isPartner && requestor.tier_id) {
      // Partners see only their tier's pricing
      const pricing = await productRepository.getTierPricingForTier(id, requestor.tier_id);
      rest.tier_pricing = pricing ? [pricing] : [];
    } else if (!isPartner) {
      // Admin/CM sees all tier pricing
      rest.tier_pricing = await productRepository.getTierPricing(id);
    }

    return rest;
  }

  async create(data: any) {
    // Check for duplicate SKU
    const existing = await productRepository.findBySku(data.sku);
    if (existing) {
      throw new AppError(
        `A product with SKU '${data.sku}' already exists`,
        409,
        'PRODUCT_DUPLICATE_SKU',
      );
    }

    // Validate category exists if provided
    if (data.category_id) {
      const category = await productRepository.findCategoryById(data.category_id);
      if (!category) {
        throw AppError.notFound('Product category not found');
      }
    }

    return productRepository.create(data);
  }

  async update(id: string, data: any) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    // Check SKU uniqueness if changing
    if (data.sku && data.sku !== product.sku) {
      const existing = await productRepository.findBySku(data.sku);
      if (existing) {
        throw new AppError(`A product with SKU '${data.sku}' already exists`, 409, 'PRODUCT_DUPLICATE_SKU');
      }
    }

    // Validate category if changing
    if (data.category_id) {
      const category = await productRepository.findCategoryById(data.category_id);
      if (!category) {
        throw AppError.notFound('Product category not found');
      }
    }

    return productRepository.update(id, data);
  }

  async softDelete(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return productRepository.update(id, { is_active: false });
  }

  // ===== Categories =====

  async listCategories() {
    const categories = await productRepository.listCategories();
    // Build tree structure
    return this.buildCategoryTree(categories);
  }

  async createCategory(data: any) {
    // Validate parent exists if provided
    if (data.parent_id) {
      const parent = await productRepository.findCategoryById(data.parent_id);
      if (!parent) {
        throw AppError.validation('Parent category does not exist', 'parent_id');
      }
    }

    return productRepository.createCategory(data);
  }

  async updateCategory(id: string, data: any) {
    const category = await productRepository.findCategoryById(id);
    if (!category) {
      throw AppError.notFound('Category not found');
    }

    // Check circular reference
    if (data.parent_id) {
      if (data.parent_id === id) {
        throw new AppError('Category cannot be its own parent', 422, 'CATEGORY_CIRCULAR_REFERENCE');
      }

      const parent = await productRepository.findCategoryById(data.parent_id);
      if (!parent) {
        throw AppError.validation('Parent category does not exist', 'parent_id');
      }

      // Walk up the tree to detect cycles
      let current = parent;
      while (current.parent_id) {
        if (current.parent_id === id) {
          throw new AppError('Circular parent reference detected', 422, 'CATEGORY_CIRCULAR_REFERENCE');
        }
        current = await productRepository.findCategoryById(current.parent_id);
        if (!current) break;
      }
    }

    return productRepository.updateCategory(id, data);
  }

  // ===== Tier Pricing =====

  async getTierPricing(productId: string) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    return productRepository.getTierPricing(productId);
  }

  async setTierPricing(
    productId: string,
    tierId: string,
    data: { discount_pct?: number; special_price?: number },
  ) {
    // Verify product exists
    const product = await productRepository.findById(productId);
    if (!product) {
      throw AppError.notFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    // Verify tier exists
    const tier = await tierRepository.findById(tierId);
    if (!tier) {
      throw AppError.notFound('Tier not found', 'TIER_NOT_FOUND');
    }

    return productRepository.upsertTierPricing(productId, tierId, data);
  }

  // ===== Private helpers =====

  private buildCategoryTree(categories: any[]) {
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of categories) {
      const node = map.get(cat.id);
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}

export default new ProductService();
