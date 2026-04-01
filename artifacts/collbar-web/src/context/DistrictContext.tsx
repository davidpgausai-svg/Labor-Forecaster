import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useListDistricts, useListScenarios } from "@workspace/api-client-react";

interface DistrictContextType {
  districtId: string | null;
  scenarioId: string | null;
  setScenarioId: (id: string | null) => void;
  isLoading: boolean;
}

const DistrictContext = createContext<DistrictContextType>({
  districtId: null,
  scenarioId: null,
  setScenarioId: () => {},
  isLoading: true,
});

export function DistrictProvider({ children }: { children: ReactNode }) {
  const { data: districts, isLoading: districtLoading } = useListDistricts();
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  const districtId = districts && districts.length > 0 ? districts[0].id : null;

  const { data: scenarios, isLoading: scenariosLoading } = useListScenarios(
    { districtId: districtId! },
    { query: { enabled: !!districtId } }
  );

  useEffect(() => {
    if (scenarios && scenarios.length > 0 && !scenarioId) {
      const finalScenario = scenarios.find(s => s.isFinal);
      const activeScenario = scenarios.find(s => s.status === "active");
      setScenarioId((finalScenario || activeScenario || scenarios[0]).id);
    }
  }, [scenarios, scenarioId]);

  return (
    <DistrictContext.Provider
      value={{
        districtId,
        scenarioId,
        setScenarioId,
        isLoading: districtLoading || scenariosLoading,
      }}
    >
      {children}
    </DistrictContext.Provider>
  );
}

export function useDistrictContext() {
  return useContext(DistrictContext);
}
