import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface DraftMember {
  name: string;
  phone: string;
  city: string;
}

interface Props {
  members: DraftMember[];
  onChange: (members: DraftMember[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepAddMembers({ members, onChange, onNext, onBack }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");

  function addMember() {
    if (!name.trim() || !phone.trim()) return;
    onChange([...members, { name: name.trim(), phone: phone.trim(), city: city.trim() }]);
    setName("");
    setPhone("");
    setCity("");
  }

  function removeMember(index: number) {
    onChange(members.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="member-name">Name *</Label>
        <Input
          id="member-name"
          placeholder="Member name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="member-phone">Phone *</Label>
        <Input
          id="member-phone"
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="member-city">City (optional)</Label>
        <Input
          id="member-city"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <Button
        variant="secondary"
        onClick={addMember}
        disabled={!name.trim() || !phone.trim()}
        className="w-full"
      >
        Add Member
      </Button>

      {members.length > 0 && (
        <div className="space-y-2">
          {members.map((m, i) => (
            <Card key={i}>
              <CardContent className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMember(i)}
                >
                  Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} disabled={members.length === 0} className="flex-1">
          Next
        </Button>
      </div>
    </div>
  );
}
