import type { CreateAcademyBody, UpdateAcademyBody } from "@tatame/validators";
import type { RepoFactory } from "../../lib/repo-factory.js";
import { HttpError } from "../../lib/http-error.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { IAcademyRepository } from "./academy.repository.js";

export class AcademyService {
  constructor(
    private readonly academyRepo: IAcademyRepository,
    private readonly membershipRepoFactory: RepoFactory<IMembershipRepository>,
  ) {}

  async createWithManagerMembership(ownerUserId: string, body: CreateAcademyBody) {
    return this.academyRepo.withTransaction(async (txAcademyRepo, createRepo) => {
      const created = await txAcademyRepo.create({
        ownerId: ownerUserId,
        name: body.name,
        logoUrl: body.logoUrl ?? null,
        address: body.address ?? null,
        contactEmail: body.contactEmail ?? null,
        contactPhone: body.contactPhone ?? null,
        foundedAt: body.foundedAt ?? null,
      });

      const txMembershipRepo = createRepo(this.membershipRepoFactory);
      await txMembershipRepo.create({
        academyId: created.id,
        userId: ownerUserId,
        role: "manager",
        status: "active",
        isActive: true,
        joinedAt: new Date(),
        leftAt: null,
      });

      return created;
    });
  }

  async getById(academyId: string) {
    return (await this.academyRepo.findById(academyId)) ?? null;
  }

  /**
   * What an unauthenticated caller may read. The invite page at
   * `/convite/<academyId>` has no session, so it cannot use `getById`: that
   * returns the whole row, `pixKey` and the contact details included, and a
   * uuid is all anyone would need. Three fields, built explicitly rather than
   * by omission, so a column added to the table does not join the response.
   */
  async getPublicById(academyId: string) {
    const row = await this.academyRepo.findById(academyId);
    if (!row) return null;
    return { id: row.id, name: row.name, logoUrl: row.logoUrl };
  }

  async searchByName(q: string, limit = 50) {
    const term = q.trim();
    if (!term) return [];
    return this.academyRepo.searchByName(term, limit);
  }

  async getStats(academyId: string, ownerUserId: string) {
    await this.assertManagerOwnsAcademy(ownerUserId, academyId);
    const currentDayOfWeek = new Date().getDay(); // 0=Sunday
    return this.academyRepo.getStats(academyId, currentDayOfWeek);
  }

  async update(academyId: string, ownerUserId: string, body: UpdateAcademyBody) {
    await this.assertManagerOwnsAcademy(ownerUserId, academyId);

    const updated = await this.academyRepo.update(academyId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
      ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
      ...(body.foundedAt !== undefined ? { foundedAt: body.foundedAt } : {}),
    });
    if (!updated) {
      throw new HttpError(404, "Academy not found");
    }
    return updated;
  }

  private async assertManagerOwnsAcademy(userId: string, academyId: string) {
    const academy = await this.academyRepo.findById(academyId);
    if (!academy) {
      throw new HttpError(404, "Academy not found");
    }
    if (academy.ownerId !== userId) {
      throw new HttpError(403, "You do not manage this academy");
    }
  }
}
