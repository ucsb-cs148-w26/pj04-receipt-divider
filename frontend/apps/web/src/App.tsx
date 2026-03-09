import { Routes, Route, Navigate } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';
import JoinPage from './pages/JoinPage';
import ReceiptGroupPage from './pages/ReceiptGroupPage';
import ProfileSelectPage from './pages/ProfileSelectPage';
import ErrorPage from './pages/ErrorPage';

function App() {
  return (
    <Routes>
      <Route path='/' element={<h1>Eezy Receipt</h1>} />
      <Route path='/profile' element={<ProfileSelectPage />} />
      <Route path='/join' element={<JoinPage />} />
      <Route
        path='/group/:groupId'
        element={
          <ProtectedRoute>
            <ReceiptGroupPage />
          </ProtectedRoute>
        }
      />
      <Route path='/error' element={<ErrorPage />} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  );
}

export default App;
