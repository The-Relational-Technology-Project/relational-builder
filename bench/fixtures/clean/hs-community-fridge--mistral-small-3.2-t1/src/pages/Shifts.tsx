import { useStore } from '@/stores/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function ShiftsPage() {
  const { shifts, claimShift } = useStore();

  const handleClaimShift = (shiftId: string) => {
    claimShift(shiftId, 'You');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Volunteer for a Shift</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Help keep the fridge running smoothly by volunteering for a cleaning or restocking shift.
          </p>

          <div className="space-y-4">
            {shifts.map(shift => (
              <div key={shift.id} className="p-4 bg-secondary rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {shift.type} shift on {new Date(shift.date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {shift.time}
                    </p>
                  </div>
                  {!shift.claimed ? (
                    <Button
                      onClick={() => handleClaimShift(shift.id)}
                      size="sm"
                    >
                      Claim this shift
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Claimed by {shift.claimedBy}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  );
}