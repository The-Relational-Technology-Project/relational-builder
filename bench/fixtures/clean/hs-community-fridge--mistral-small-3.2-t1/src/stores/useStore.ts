import { create } from 'zustand';

type Post = {
  id: string;
  text: string;
  author: string;
  date: string;
  type: 'update' | 'status';
};

type Shift = {
  id: string;
  date: string;
  time: string;
  type: 'cleaning' | 'restocking';
  claimed: boolean;
  claimedBy?: string;
};

type Store = {
  status: 'full' | 'empty';
  posts: Post[];
  shifts: Shift[];
  addPost: (post: Omit<Post, 'id'>) => void;
  updateStatus: (status: 'full' | 'empty') => void;
  claimShift: (shiftId: string, claimedBy: string) => void;
};

export const useStore = create<Store>((set) => ({
  status: 'full',
  posts: [],
  shifts: [],

  addPost: (post) =>
    set((state) => ({
      posts: [...state.posts, { ...post, id: Date.now().toString() }],
    })),

  updateStatus: (status) =>
    set(() => ({
      status,
      posts: [...posts, {
        id: Date.now().toString(),
        text: `Fridge status updated to ${status}`,
        author: 'System',
        date: new Date().toISOString(),
        type: 'status'
      }]
    })),

  claimShift: (shiftId, claimedBy) =>
    set((state) => ({
      shifts: state.shifts.map(shift =>
        shift.id === shiftId ? { ...shift, claimed: true, claimedBy } : shift
      ),
    })),
}));

// Seed data
const seedData = () => {
  useStore.setState({
    status: 'full',
    posts: [
      {
        id: '1',
        text: 'Just stocked with fresh produce from the farmers market!',
        author: 'Mara',
        date: new Date(Date.now() - 86400000).toISOString(),
        type: 'update'
      },
      {
        id: '2',
        text: 'We need more canned goods and non-perishable items',
        author: 'Alex',
        date: new Date(Date.now() - 172800000).toISOString(),
        type: 'update'
      },
      {
        id: '3',
        text: 'Fridge is getting low on dairy products',
        author: 'Jamie',
        date: new Date(Date.now() - 259200000).toISOString(),
        type: 'update'
      },
      {
        id: '4',
        text: 'Fridge status updated to full',
        author: 'System',
        date: new Date(Date.now() - 3600000).toISOString(),
        type: 'status'
      }
    ],
    shifts: [
      {
        id: '1',
        date: new Date(Date.now() + 86400000).toISOString(),
        time: '10:00 AM - 12:00 PM',
        type: 'cleaning',
        claimed: false
      },
      {
        id: '2',
        date: new Date(Date.now() + 172800000).toISOString(),
        time: '2:00 PM - 4:00 PM',
        type: 'restocking',
        claimed: false
      },
      {
        id: '3',
        date: new Date(Date.now() + 259200000).toISOString(),
        time: '11:00 AM - 1:00 PM',
        type: 'cleaning',
        claimed: true,
        claimedBy: 'Sarah'
      },
      {
        id: '4',
        date: new Date(Date.now() + 345600000).toISOString(),
        time: '3:00 PM - 5:00 PM',
        type: 'restocking',
        claimed: false
      },
      {
        id: '5',
        date: new Date(Date.now() + 432000000).toISOString(),
        time: '10:00 AM - 12:00 PM',
        type: 'cleaning',
        claimed: false
      },
      {
        id: '6',
        date: new Date(Date.now() + 518400000).toISOString(),
        time: '2:00 PM - 4:00 PM',
        type: 'restocking',
        claimed: false
      },
      {
        id: '7',
        date: new Date(Date.now() + 604800000).toISOString(),
        time: '11:00 AM - 1:00 PM',
        type: 'cleaning',
        claimed: false
      }
    ]
  });
};

// Seed the data when the store is created
seedData();

export default useStore;