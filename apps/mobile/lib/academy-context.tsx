import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type AcademyContextValue = {
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
};

type updateAcademyContextProps = {
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
}

const AcademyContext = createContext<AcademyContextValue | null>(null);

export function AcademyProvider({
  value,
  children,
}: {
  value: AcademyContextValue;
  children: ReactNode;
}) {
  return (
    <AcademyContext.Provider value={value}>{children}</AcademyContext.Provider>
  );
}

export function useAcademyContext(): AcademyContextValue {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error("useAcademyContext must be used within AcademyProvider");
  }
  return ctx;
}


export function useUpdateAcademyContext(): (props: updateAcademyContextProps) => void {
  const ctx = useContext(AcademyContext);
  if (!ctx) {
    throw new Error("useUpdateAcademyContext must be used within AcademyProvider");
  }
  return (props: updateAcademyContextProps) => {
    ctx.academyId = props.academyId;
    ctx.academyName = props.academyName;
    ctx.academyLogoUrl = props.academyLogoUrl;
  };
}