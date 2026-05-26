import { MembersListContent } from "@/components/MembersListContent";

const MANAGER_TABS = [
  { key: "all", label: "Todos" },
  { key: "instructor", label: "Instrutores" },
  { key: "student", label: "Alunos" },
  { key: "guardian", label: "Responsáveis" },
  { key: "dependent", label: "Dependentes" },
  { key: "pending", label: "Pendentes" },
];

export default function MembersListScreen() {
  return (
    <MembersListContent
      showBackButton
      allowMemberDetails
      tabs={MANAGER_TABS}
      getMemberDetailHref={(membershipId) =>
        `/(app)/(manager)/(members)/${membershipId}`
      }
      getDependentDetailHref={(dependentId, guardianName, guardianMembershipId) =>
        `/(app)/(manager)/(members)/dependent/${dependentId}?guardianName=${encodeURIComponent(guardianName ?? "")}&guardianMembershipId=${guardianMembershipId ?? ""}`
      }
    />
  );
}
