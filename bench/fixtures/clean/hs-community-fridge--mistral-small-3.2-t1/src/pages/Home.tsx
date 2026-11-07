import { useStore } from '@/stores/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const { status, posts, shifts } = useStore();

  const recentPosts = posts.slice(0, 3);
  const upcomingShifts = shifts.filter(shift => new Date(shift.date) >= new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center p-6 bg-card rounded-lg shadow-sm">
        <h1 className="text-3xl md:text-4xl font-bold text-center mb-2">
          Judah St Community Fridge
        </h1>
        <p className="text-lg text-muted-foreground text-center mb-4">
          A neighborhood effort to reduce food waste and support our community
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild variant="default" size="lg">
            <Link to="/posts">What's in the fridge</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/shifts">Volunteer for a shift</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Fridge Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant={status === 'full' ? 'default' : 'outline'} className="text-lg p-3">
                {status === 'full' ? 'Fridge is full' : 'Fridge is empty'}
              </Badge>
              <Button asChild variant="outline">
                <Link to="/posts">Update status</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPosts.length > 0 ? (
              <ul className="space-y-3">
                {recentPosts.map(post => (
                  <li key={post.id} className="p-3 bg-secondary rounded-lg">
                    <p className="font-medium">{post.text}</p>
                    <p className="text-sm text-muted-foreground">
                      Posted by {post.author} on {new Date(post.date).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent updates yet. Be the first to post!</p>
            )}
            <Button asChild className="mt-3">
              <Link to="/posts">View all updates</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingShifts.length > 0 ? (
            <ul className="space-y-3">
              {upcomingShifts.map(shift => (
                <li key={shift.id} className="p-3 bg-secondary rounded-lg">
                  <p className="font-medium">
                    {shift.type} shift on {new Date(shift.date).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {shift.claimed ? 'Claimed by ' + shift.claimedBy : 'Available'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No upcoming shifts scheduled.</p>
          )}
          <Button asChild className="mt-3">
            <Link to="/shifts">View all shifts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}