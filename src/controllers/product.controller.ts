import { Request, Response, NextFunction } from 'express';
import productService from '../services/product.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class ProductController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        category_id: req.query.category_id as string | undefined,
        product_type: req.query.product_type as string | undefined,
        is_active: req.query.is_active as string | undefined,
        search: req.query.search as string | undefined,
      };

      const { data, total } = await productService.list(
        filters,
        pagination,
        req.query.sort as string,
        req.user!,
      );

      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.getById(req.params.id, req.user!);
      sendSuccess(res, product, 200);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.create(req.body);
      sendSuccess(res, product, 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.update(req.params.id, req.body);
      sendSuccess(res, product, 200);
    } catch (err) {
      next(err);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await productService.softDelete(req.params.id);
      sendSuccess(res, product, 200);
    } catch (err) {
      next(err);
    }
  }

  // Categories
  async listCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await productService.listCategories();
      sendSuccess(res, categories, 200);
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await productService.createCategory(req.body);
      sendSuccess(res, category, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await productService.updateCategory(req.params.id, req.body);
      sendSuccess(res, category, 200);
    } catch (err) {
      next(err);
    }
  }

  // Tier Pricing
  async getTierPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const pricing = await productService.getTierPricing(req.params.id);
      sendSuccess(res, pricing, 200);
    } catch (err) {
      next(err);
    }
  }

  async setTierPricing(req: Request, res: Response, next: NextFunction) {
    try {
      const pricing = await productService.setTierPricing(
        req.params.id,
        req.params.tierId,
        req.body,
      );
      sendSuccess(res, pricing, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new ProductController();
