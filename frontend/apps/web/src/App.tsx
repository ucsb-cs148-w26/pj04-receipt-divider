import { Routes, Route, Navigate } from 'react-router';
import JoinPage from './pages/JoinPage';
import GroupPage from './pages/GroupPage';

function App() {
  return (
    <Routes>
      <Route path='/' element={<h1>Eezy Receipt</h1>} />
      <Route path='/join' element={<JoinPage />} />
      <Route path='/group/:roomId' element={<GroupPage />} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  );
}

export default App;
