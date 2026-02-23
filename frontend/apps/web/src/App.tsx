import { Routes, Route } from 'react-router';
import JoinPage from './pages/JoinPage';
import GroupPage from './pages/GroupPage';

function App() {
  return (
    <Routes>
      <Route path='/join' element={<JoinPage />} />
      <Route path='/group/:roomId' element={<GroupPage />} />
    </Routes>
  );
}

export default App;
