import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  useListDistricts,
  useListScenarios,
  getListScenariosQueryKey,
  useGetScenario,
  getGetScenarioQueryKey,
} from "@workspace/api-client-react";

interface DistrictContextType {
  districtId: string | null;
  districtName: string | null;
  scenarioId: string | null;
  setScenarioId: (id: string | null) => void;
  activeContractYear: number | null;
  setActiveContractYear: (year: number | null) => void;
  contractYears: number[];
  yearLabelMap: Map<number, string>;
  isLoading: boolean;
}

const DistrictContext = createContext<DistrictContextType>({
  districtId: null,
  districtName: null,
  yearLabelMap: new Map(),
  scenarioId: null,
  setScenarioId: () => {},
  activeContractYear: null,
  setActiveContractYear: () => {},
  contractYears: [],
  isLoading: true,
});

export function DistrictProvider({ children }: { children: ReactNode }) {
  const { data: districts, isLoading: districtLoading } = useListDistricts();
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [activeContractYear, setActiveContractYear] = useState<number | null>(null);

  const district = districts && districts.length > 0 ? districts[0] : null;
  const districtId = district?.id ?? null;
  const districtName = district?.name ?? null;

  const { data: scenarios, isLoading: scenariosLoading } = useListScenarios(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListScenariosQueryKey({ districtId: districtId! }) } }
  );

  useEffect(() => {
    if (scenarios && scenarios.length > 0 && !scenarioId) {
      const finalScenario = scenarios.find(s => s.isFinal);
      const activeScenario = scenarios.find(s => s.status === "active");
      setScenarioId((finalScenario || activeScenario || scenarios[0]).id);
    }
  }, [scenarios, scenarioId]);

  const { data: fullScenario, isLoading: scenarioLoading } = useGetScenario(scenarioId!, {
    query: { enabled: !!scenarioId, queryKey: getGetScenarioQueryKey(scenarioId!) },
  });

  const contractYears: number[] = fullScenario?.yearConfigs
    ? [...new Set(fullScenario.yearConfigs.map(c => c.contractYear))].sort()
    : [];

  const yearLabelMap = new Map<number, string>();
  fullScenario?.yearConfigs?.forEach(c => {
    if (!yearLabelMap.has(c.contractYear)) {
      yearLabelMap.set(c.contractYear, c.yearLabel ?? `Year ${c.contractYear}`);
    }
  });

  useEffect(() => {
    if (contractYears.length > 0 && !activeContractYear) {
      setActiveContractYear(contractYears[0]);
    }
  }, [contractYears.join(","), activeContractYear]);

  return (
    <DistrictContext.Provider
      value={{
        districtId,
        districtName,
        scenarioId,
        setScenarioId,
        activeContractYear,
        setActiveContractYear,
        contractYears,
        yearLabelMap,
        isLoading: districtLoading || scenariosLoading || scenarioLoading,
      }}
    >
      {children}
    </DistrictContext.Provider>
  );
}

export function useDistrictContext() {
  return useContext(DistrictContext);
}
