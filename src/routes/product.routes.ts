import { Router } from 'express';
import productController from '../controllers/product.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  tierPricingParamSchema,
  tierPricingSchema,
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  listProductsQuerySchema,
} from '../validators/product.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Category routes (must be defined BEFORE /:id to avoid conflict)
router.get('/categories', productController.listCategories);
router.post(
  '/categories',
  authorize('admin'),
  validate(createCategorySchema),
  productController.createCategory,
);
router.patch(
  '/categories/:id',
  authorize('admin'),
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategorySchema),
  productController.updateCategory,
);

// List products
router.get('/', validate(listProductsQuerySchema, 'query'), productController.list);

// Create product — admin only
router.post(
  '/',
  authorize('admin'),
  validate(createProductSchema),
  productController.create,
);

// Get product by ID
router.get(
  '/:id',
  validate(productIdParamSchema, 'params'),
  productController.getById,
);

// Update product — admin only
router.patch(
  '/:id',
  authorize('admin'),
  validate(productIdParamSchema, 'params'),
  validate(updateProductSchema),
  productController.update,
);

// Soft-delete product — admin only
router.delete(
  '/:id',
  authorize('admin'),
  validate(productIdParamSchema, 'params'),
  productController.softDelete,
);

// Tier pricing for a product
router.get(
  '/:id/tier-pricing',
  authorize('admin', 'channel_manager'),
  validate(productIdParamSchema, 'params'),
  productController.getTierPricing,
);

router.put(
  '/:id/tier-pricing/:tierId',
  authorize('admin'),
  validate(tierPricingParamSchema, 'params'),
  validate(tierPricingSchema),
  productController.setTierPricing,
);

export default router;
