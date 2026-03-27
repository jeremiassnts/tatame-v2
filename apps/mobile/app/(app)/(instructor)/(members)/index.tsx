import { MembersListContent } from "@/components/MembersListContent";

export default function InstructorMembersListScreen() {
  return (
    <MembersListContent
      allowMemberDetails
      getMemberDetailHref={(membershipId) =>
        `/(app)/(instructor)/(members)/${membershipId}`
      }
      additionalFilter={(m) => m.role !== "manager"}
    />
  );
}
