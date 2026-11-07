import { useStore } from '@/stores/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PostsPage() {
  const { posts, addPost, updateStatus } = useStore();
  const [postText, setPostText] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('');

  const handleAddPost = () => {
    if (postText.trim()) {
      addPost({
        id: Date.now().toString(),
        text: postText,
        author: 'You',
        date: new Date().toISOString(),
        type: 'update'
      });
      setPostText('');
    }
  };

  const handleStatusUpdate = () => {
    if (statusUpdate) {
      updateStatus(statusUpdate);
      setStatusUpdate('');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Update the Fridge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="mb-2 font-medium">What's in the fridge?</p>
              <div className="flex gap-2">
                <Input
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="e.g., 'Just stocked with fresh produce and bread'"
                />
                <Button onClick={handleAddPost}>Post</Button>
              </div>
            </div>

            <div>
              <p className="mb-2 font-medium">Fridge Status</p>
              <div className="flex gap-2">
                <select
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value)}
                  className="flex-1 p-2 rounded-lg border border-input bg-background"
                >
                  <option value="">Select status</option>
                  <option value="full">Fridge is full</option>
                  <option value="empty">Fridge is empty</option>
                </select>
                <Button onClick={handleStatusUpdate}>Update</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Updates</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length > 0 ? (
            <ul className="space-y-4">
              {posts.map(post => (
                <li key={post.id} className="p-4 bg-secondary rounded-lg">
                  <p className="font-medium">{post.text}</p>
                  <p className="text-sm text-muted-foreground">
                    Posted by {post.author} on {new Date(post.date).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No updates yet. Be the first to post!</p>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  );
}