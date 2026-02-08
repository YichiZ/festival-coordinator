import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}

export function StepGroupName({ value, onChange, onNext }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="group-name">Group Name</Label>
        <Input
          id="group-name"
          placeholder="e.g. Summer Festival Crew"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) onNext();
          }}
        />
      </div>
      <Button onClick={onNext} disabled={!value.trim()} className="w-full">
        Next
      </Button>
    </div>
  );
}
