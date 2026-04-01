import { useState, useEffect } from "react";
import { useDistrictContext } from "@/context/DistrictContext";
import { useGetDistrict, getGetDistrictQueryKey, useUpdateDistrict, useListBargainingUnits, getListBargainingUnitsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { districtId } = useDistrictContext();
  const { toast } = useToast();

  const { data: district, isLoading: districtLoading } = useGetDistrict(districtId!, {
    query: { enabled: !!districtId, queryKey: getGetDistrictQueryKey(districtId!) }
  });

  const { data: units, isLoading: unitsLoading } = useListBargainingUnits(
    { districtId: districtId! },
    { query: { enabled: !!districtId, queryKey: getListBargainingUnitsQueryKey({ districtId: districtId! }) } }
  );

  const updateDistrictMutation = useUpdateDistrict();
  
  const [districtData, setDistrictData] = useState({
    name: "",
    state: "",
    fiscalYearStart: "",
    studentEnrollment: 0
  });

  useEffect(() => {
    if (district) {
      setDistrictData({
        name: district.name,
        state: district.state || "",
        fiscalYearStart: district.fiscalYearStart || "",
        studentEnrollment: district.studentEnrollment || 0
      });
    }
  }, [district]);

  const handleSaveDistrict = () => {
    updateDistrictMutation.mutate({
      id: districtId!,
      data: districtData
    }, {
      onSuccess: () => {
        toast({ title: "Saved", description: "District settings updated." });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Manage district profile and bargaining unit configurations.</p>
      </div>

      {districtLoading ? <Skeleton className="h-64 w-full" /> : (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>District Profile</CardTitle>
            <CardDescription>Global settings for {district?.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">District Name</label>
                <Input value={districtData.name} onChange={e => setDistrictData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">State</label>
                <Input value={districtData.state} onChange={e => setDistrictData(p => ({ ...p, state: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Fiscal Year Start</label>
                <Input type="date" value={districtData.fiscalYearStart ? districtData.fiscalYearStart.substring(0, 10) : ""} onChange={e => setDistrictData(p => ({ ...p, fiscalYearStart: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Student Enrollment</label>
                <Input type="number" value={districtData.studentEnrollment || ""} onChange={e => setDistrictData(p => ({ ...p, studentEnrollment: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={handleSaveDistrict} disabled={updateDistrictMutation.isPending}>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bargaining Units</CardTitle>
            <CardDescription>Manage unit configurations and benefit rates</CardDescription>
          </div>
          <Button variant="outline">Add Unit</Button>
        </CardHeader>
        <CardContent>
          {unitsLoading ? <Skeleton className="h-32 w-full" /> : (
            <div className="space-y-4">
              {units?.map(unit => (
                <div key={unit.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                  <div>
                    <h4 className="font-semibold">{unit.name} <span className="text-muted-foreground text-sm font-normal">({unit.code})</span></h4>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary">{unit.compensationType}</Badge>
                      <Badge variant="secondary">{unit.retirementSystem}</Badge>
                      <span className="text-xs text-muted-foreground ml-2">{unit.contractYears} Year Contract</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
