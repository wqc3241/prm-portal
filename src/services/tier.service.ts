import tierRepository from '../repositories/tier.repository';
import { AppError } from '../utils/AppError';
import { OrgScope } from '../types/express';

class TierService {
  async list() {
    return tierRepository.list();
  }

  async getById(id: string) {
    const tier = await tierRepository.findById(id);
    if (!tier) {
      throw AppError.notFound('Tier not found');
    }
    return tier;
  }

  async create(data: any) {
    // Check for duplicate name
    const existingName = await tierRepository.findByName(data.name);
    if (existingName) {
      throw new AppError(
        `A tier with name '${data.name}' already exists`,
        409,
        'TIER_DUPLICATE',
      );
    }

    // Check for duplicate rank
    const existingRank = await tierRepository.findByRank(data.rank);
    if (existingRank) {
      throw new AppError(
        `A tier with rank ${data.rank} already exists`,
        409,
        'TIER_DUPLICATE',
      );
    }

    // Validate max_discount_pct >= default_discount_pct
    if (data.max_discount_pct !== undefined && data.default_discount_pct !== undefined) {
      if (data.max_discount_pct < data.default_discount_pct) {
        throw AppError.validation(
          'max_discount_pct must be greater than or equal to default_discount_pct',
          'max_discount_pct',
        );
      }
    }

    return tierRepository.create(data);
  }

  async update(id: string, data: any) {
    const tier = await tierRepository.findById(id);
    if (!tier) {
      throw AppError.notFound('Tier not found');
    }

    // Check name uniqueness if changing name
    if (data.name && data.name !== tier.name) {
      const existing = await tierRepository.findByName(data.name);
      if (existing) {
        throw new AppError(`A tier with name '${data.name}' already exists`, 409, 'TIER_DUPLICATE');
      }
    }

    // Check rank uniqueness if changing rank
    if (data.rank !== undefined && data.rank !== tier.rank) {
      const existing = await tierRepository.findByRank(data.rank);
      if (existing) {
        throw new AppError(`A tier with rank ${data.rank} already exists`, 409, 'TIER_DUPLICATE');
      }
    }

    // Validate discount relationship
    const newMax = data.max_discount_pct ?? tier.max_discount_pct;
    const newDefault = data.default_discount_pct ?? tier.default_discount_pct;
    if (parseFloat(newMax) < parseFloat(newDefault)) {
      throw AppError.validation(
        'max_discount_pct must be greater than or equal to default_discount_pct',
        'max_discount_pct',
      );
    }

    return tierRepository.update(id, data);
  }

  async delete(id: string) {
    const tier = await tierRepository.findById(id);
    if (!tier) {
      throw AppError.notFound('Tier not found');
    }

    const orgCount = await tierRepository.countOrgs(id);
    if (orgCount > 0) {
      throw new AppError(
        `Cannot delete tier '${tier.name}': ${orgCount} organization(s) are assigned to this tier`,
        422,
        'TIER_HAS_ORGS',
      );
    }

    await tierRepository.delete(id);
    return { message: `Tier '${tier.name}' deleted successfully` };
  }

  async listOrganizations(
    tierId: string,
    scope: OrgScope,
    pagination: { offset: number; limit: number },
  ) {
    const tier = await tierRepository.findById(tierId);
    if (!tier) {
      throw AppError.notFound('Tier not found');
    }

    return tierRepository.listOrganizations(tierId, scope, pagination);
  }
}

export default new TierService();
