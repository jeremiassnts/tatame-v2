import { AcademyInfo } from "@/components/AcademyInfo";
import { useCancelMembership } from "@/lib/hooks/use-membership";
import { useCurrentUser } from "@/lib/hooks/use-user";

export default function InstructorAcademyInfoScreen() {
  const { data: user } = useCurrentUser();
  const cancelMembership = useCancelMembership();

  return (
    <AcademyInfo
      onLeave={() => cancelMembership.mutate()}
      isLeaving={cancelMembership.isPending}
      memberSince={user?.activeMembership?.joinedAt ?? null}
    />
  );
}
