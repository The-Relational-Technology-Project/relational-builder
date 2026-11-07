import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>About the Judah St Community Fridge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              The Judah St Community Fridge is a neighborhood initiative to reduce food waste and support our community in the Outer Sunset.
            </p>
            <p>
              Located outside the laundromat on Judah St, this fridge is stocked with surplus food from local businesses, community members, and food rescue organizations.
            </p>
            <p>
              Everyone is welcome to take what they need and contribute what they can. The fridge operates on a "take what you need, leave what you can" principle.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meet the Stewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name="Mara Ellison" className="h-12 w-12" />
              <div>
                <p className="font-medium">Mara Ellison</p>
                <p className="text-sm text-muted-foreground">Fridge Coordinator</p>
              </div>
            </div>
            <p>
              Mara helps coordinate the fridge operations and volunteers. She's always looking for more helpers to keep the fridge running smoothly!
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Help</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h3 className="font-medium">Donate Food</h3>
            <p>
              You can donate non-perishable food items, fresh produce, or prepared meals. Please ensure all donations are in sealed containers.
            </p>

            <h3 className="font-medium">Volunteer</h3>
            <p>
              Help with cleaning, restocking, or organizing the fridge. Sign up for a shift on the Shifts page.
            </p>

            <h3 className="font-medium">Spread the Word</h3>
            <p>
              Tell your neighbors about the fridge and encourage them to use it. The more people who know about it, the more it can help our community.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  );
}