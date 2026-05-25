import type { Belt, Role } from "@tatame/types";
import { HttpError } from "../../lib/http-error.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { IGraduationRepository } from "../graduation/graduation.repository.js";
import type { IStudentSubscriptionRepository } from "../subscription/subscription.repository.js";
import type { IDependentRepository, DependentRow } from "./dependent.repository.js";
import { assertValidBeltRank } from "../graduation/graduation.service.js";

export class DependentService {
  constructor(
    private readonly dependentRepo: IDependentRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly graduationRepo: IGraduationRepository,
    private readonly studentSubRepo: IStudentSubscriptionRepository,
  ) {}

  async create(opts: {
    userId: string;
    role: Role;
    academyId: string;
    name: string;
    birthDate: string;
    belt: Belt;
    stripes: number;
  }): Promise<DependentRow> {
    if (opts.role !== "guardian" && opts.role !== "student") {
      throw new HttpError(403, "Apenas responsáveis e alunos podem cadastrar dependentes");
    }

    const membership = await this.membershipRepo.findActiveByUserAndAcademy(
      opts.userId,
      opts.academyId,
    );
    if (!membership || membership.status !== "active") {
      throw new HttpError(403, "Matrícula ativa na academia é necessária");
    }

    assertValidBeltRank(opts.belt, opts.stripes);

    const dependent = await this.dependentRepo.insert({
      guardianId: opts.userId,
      academyId: opts.academyId,
      name: opts.name,
      birthDate: opts.birthDate,
    });

    // Register initial belt for the dependent
    await this.graduationRepo.insertInitialCurrent({
      userId: opts.userId,
      academyId: opts.academyId,
      promotedBy: opts.userId,
      belt: opts.belt,
      stripes: opts.stripes,
      notes: null,
      dependentId: dependent.id,
    });

    return dependent;
  }

  async listMine(userId: string) {
    const deps = await this.dependentRepo.findByGuardian(userId);
    return this.enrichMany(deps);
  }

  async listByGuardian(guardianId: string) {
    const deps = await this.dependentRepo.findByGuardian(guardianId);
    return this.enrichMany(deps);
  }

  private async enrichOne(dep: DependentRow) {
    const belt = await this.graduationRepo.findCurrentByDependentId(dep.id);
    return {
      id: dep.id,
      guardianId: dep.guardianId,
      academyId: dep.academyId,
      name: dep.name,
      birthDate: dep.birthDate,
      currentBelt: belt
        ? { belt: belt.belt, stripes: belt.stripes }
        : null,
      subscriptionStatus: null as string | null,
      createdAt: dep.createdAt.toISOString(),
    };
  }

  private async enrichMany(deps: DependentRow[]) {
    return Promise.all(deps.map((dep) => this.enrichOne(dep)));
  }

  async getById(
    userId: string,
    role: Role,
    dependentId: string,
    academyId?: string,
  ) {
    const dep = await this.findAndAuthorize(userId, role, dependentId, academyId);
    return this.enrichOne(dep);
  }

  private async findAndAuthorize(
    userId: string,
    role: Role,
    dependentId: string,
    academyId?: string,
  ): Promise<DependentRow> {
    const dep = await this.dependentRepo.findById(dependentId);
    if (!dep) throw new HttpError(404, "Dependente não encontrado");

    if (role !== "manager") {
      if (dep.guardianId !== userId) {
        throw new HttpError(404, "Dependente não encontrado");
      }
    } else {
      if (academyId && dep.academyId !== academyId) {
        throw new HttpError(404, "Dependente não encontrado");
      }
    }

    return dep;
  }

  async update(
    userId: string,
    role: Role,
    dependentId: string,
    data: {
      name?: string;
      birthDate?: string;
    },
    academyId?: string,
  ): Promise<DependentRow | undefined> {
    const dep = await this.findAndAuthorize(userId, role, dependentId, academyId);

    if (role !== "manager" && dep.guardianId !== userId) {
      throw new HttpError(403, "Sem permissão para editar este dependente");
    }

    return this.dependentRepo.update(dependentId, data);
  }

  async delete(
    userId: string,
    role: Role,
    dependentId: string,
    academyId?: string,
  ): Promise<void> {
    const dep = await this.findAndAuthorize(userId, role, dependentId, academyId);

    if (role !== "manager" && dep.guardianId !== userId) {
      throw new HttpError(403, "Sem permissão para excluir este dependente");
    }

    await this.dependentRepo.softDelete(dependentId);
  }

  async listByAcademy(
    userId: string,
    role: Role,
    academyId: string,
  ): Promise<DependentRow[]> {
    if (role !== "manager") {
      throw new HttpError(403, "Apenas gestores podem listar dependentes da academia");
    }
    return this.dependentRepo.findByAcademy(academyId);
  }

  async assertGuardianOwnership(userId: string, dependentId: string): Promise<DependentRow> {
    const dep = await this.dependentRepo.findById(dependentId);
    if (!dep || dep.guardianId !== userId) {
      throw new HttpError(403, "Você não é responsável por este dependente");
    }
    return dep;
  }
}
