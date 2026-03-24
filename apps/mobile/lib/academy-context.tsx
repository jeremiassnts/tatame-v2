import { createContext, useContext } from "react";
import type { ReactNode } from "react";

type AcademyContextValue = {
  academyId: string;
  academyName: string;
  academyLogoUrl: string | null;
};

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
