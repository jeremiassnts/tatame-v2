import { HttpError } from "../../lib/http-error.js";
import type { IAcademyRepository } from "../academy/academy.repository.js";
import type { IClassRepository } from "../class/class.repository.js";
import type { IMembershipRepository } from "../membership/membership.repository.js";
import type { ISubscriptionPlanRepository } from "../subscription/subscription.repository.js";
import type {
  IManagerSubscriptionRepository,
  ManagerSubscriptionRow,
} from "./manager-subscription.repository.js";

const FREE_STUDENT_LIMIT = 50;
const FREE_PLAN_LIMIT = 1;
const FREE_DAILY_SCHEDULE_LIMIT = 2;

export class ManagerSubscriptionService {
  constructor(
    private readonly subRepo: IManagerSubscriptionRepository,
    private readonly acadRepo: IAcademyRepository,
    private readonly memRepo: IMembershipRepository,
    private readonly classRepo: IClassRepository,
    private readonly planRepo: ISubscriptionPlanRepository,
  ) {}

  async selectFree(
    managerUserId: string,
    academyId: string,
  ): Promise<ManagerSubscriptionRow> {
    await this.assertManagerOwnsAcademy(managerUserId, academyId);
    const existing = await this.subRepo.findByAcademyId(academyId);
    if (existing) {
      throw new HttpError(409, "Academy already has a subscription");
    }
    return this.subRepo.create({
      academyId,
      plan: "free",
      status: "active",
    });
  }

  async getSubscription(
    academyId: string,
  ): Promise<ManagerSubscriptionRow | undefined> {
    return this.subRepo.findByAcademyId(academyId);
  }

  async getLimits(academyId: string) {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub) {
      throw new HttpError(404, "No subscription found");
    }

    const isFree = sub.plan === "free";
    const isBlocked =
      (sub.status === "past_due" || sub.status === "canceled") &&
      sub.stripeSubscriptionId !== null;

    if (isBlocked) {
      const canDowngrade = await this.canDowngradeToFree(academyId);
      return {
        plan: sub.plan,
        students: { used: 0, limit: isFree ? FREE_STUDENT_LIMIT : null },
        plans: { used: 0, limit: isFree ? FREE_PLAN_LIMIT : null },
        schedulesPerDay: {
          maxUsed: 0,
          limit: isFree ? FREE_DAILY_SCHEDULE_LIMIT : null,
        },
        instructors: { allowed: !isFree },
        blocked: !canDowngrade,
      };
    }

    const activeStudents = await this.countActiveStudents(academyId);
    const activePlans = await this.countActivePlans(academyId);
    const maxClassesPerDay = await this.maxClassesPerDay(academyId);

    return {
      plan: sub.plan,
      students: {
        used: activeStudents,
        limit: isFree ? FREE_STUDENT_LIMIT : null,
      },
      plans: { used: activePlans, limit: isFree ? FREE_PLAN_LIMIT : null },
      schedulesPerDay: {
        maxUsed: maxClassesPerDay,
        limit: isFree ? FREE_DAILY_SCHEDULE_LIMIT : null,
      },
      instructors: { allowed: !isFree },
      blocked: false,
    };
  }

  async canApproveStudent(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    const count = await this.countActiveStudents(academyId);
    if (count >= FREE_STUDENT_LIMIT) {
      throw new HttpError(
        403,
        `Você atingiu o limite de ${FREE_STUDENT_LIMIT} alunos do plano gratuito. Faça upgrade para o Pro.`,
      );
    }
  }

  async canApproveInstructor(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    throw new HttpError(
      403,
      "No plano gratuito não é possível cadastrar instrutores. Faça upgrade para o Pro.",
    );
  }

  async canCreatePlan(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    const count = await this.countActivePlans(academyId);
    if (count >= FREE_PLAN_LIMIT) {
      throw new HttpError(
        403,
        "No plano gratuito você pode criar apenas 1 plano de assinatura. Faça upgrade para o Pro.",
      );
    }
  }

  async canCreateClass(academyId: string, dayOfWeek: number): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub || sub.plan !== "free") return;

    const classes = await this.classRepo.findByAcademyId(academyId, {
      dayOfWeek,
      includeInactive: false,
    });
    if (classes.length >= FREE_DAILY_SCHEDULE_LIMIT) {
      throw new HttpError(
        403,
        `No plano gratuito você pode ter no máximo ${FREE_DAILY_SCHEDULE_LIMIT} horários por dia. Faça upgrade para o Pro.`,
      );
    }
  }

  async assertNotBlocked(academyId: string): Promise<void> {
    const sub = await this.subRepo.findByAcademyId(academyId);
    if (!sub) {
      throw new HttpError(403, "Nenhuma assinatura encontrada. Selecione um plano.");
    }
    if (sub.status === "active" || sub.status === "incomplete") return;

    if (sub.stripeSubscriptionId !== null) {
      const canDowngrade = await this.canDowngradeToFree(academyId);
      if (!canDowngrade) {
        const msg =
          sub.status === "past_due"
            ? "Seu pagamento está atrasado. Atualize seus dados de pagamento para continuar usando o app."
            : "Sua assinatura foi cancelada. Reative o plano Pro para continuar usando o app.";
        throw new HttpError(403, msg);
      }
    }
  }

  private async countActiveStudents(academyId: string): Promise<number> {
    const members = await this.memRepo.findByAcademy(academyId, {
      role: "student",
      status: "active",
    });
    return members.length;
  }

  private async countActivePlans(academyId: string): Promise<number> {
    const plans = await this.planRepo.findByAcademy(academyId, {
      includeInactive: false,
    });
    return plans.length;
  }

  private async maxClassesPerDay(academyId: string): Promise<number> {
    let max = 0;
    for (let day = 0; day <= 6; day++) {
      const classes = await this.classRepo.findByAcademyId(academyId, {
        dayOfWeek: day,
        includeInactive: false,
      });
      if (classes.length > max) max = classes.length;
    }
    return max;
  }

  private async canDowngradeToFree(academyId: string): Promise<boolean> {
    const students = await this.countActiveStudents(academyId);
    if (students > FREE_STUDENT_LIMIT) return false;

    const plans = await this.countActivePlans(academyId);
    if (plans > FREE_PLAN_LIMIT) return false;

    const instructors = await this.memRepo.findByAcademy(academyId, {
      role: "instructor",
      status: "active",
    });
    if (instructors.length > 0) return false;

    for (let day = 0; day <= 6; day++) {
      const classes = await this.classRepo.findByAcademyId(academyId, {
        dayOfWeek: day,
        includeInactive: false,
      });
      if (classes.length > FREE_DAILY_SCHEDULE_LIMIT) return false;
    }

    return true;
  }

  private async assertManagerOwnsAcademy(
    userId: string,
    academyId: string,
  ): Promise<void> {
    const academy = await this.acadRepo.findById(academyId);
    if (!academy) throw new HttpError(404, "Academy not found");
    if (academy.ownerId !== userId) throw new HttpError(403, "Forbidden");
  }
}

