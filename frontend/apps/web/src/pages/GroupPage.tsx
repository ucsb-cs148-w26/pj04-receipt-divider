// TODO: implement group page
// - require auth — redirect to /join if no authorized session
// - fetch participants from backend
// - let user select which participant they are
// - fetch receipt items from backend
// - replace mock data with real items
// - allow users to claim/unclaim items

import { useParams } from 'react-router';

const MOCK_ITEMS = [
  { id: '1', name: 'Burger', price: '$12.99' },
  { id: '2', name: 'Fries', price: '$4.99' },
  { id: '3', name: 'Soda', price: '$2.99' },
];

export default function GroupPage() {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div>
      <h1>Room: {roomId}</h1>
      <ul>
        {MOCK_ITEMS.map((item) => (
          <li key={item.id}>
            {item.name} — {item.price}
          </li>
        ))}
      </ul>
    </div>
  );
}
