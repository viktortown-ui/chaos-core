import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './ui/Layout';
import { CoreScreen } from './containers/CoreScreen';
import { ProfileScreen } from './containers/ProfileScreen';
import { QuestsScreen } from './containers/QuestsScreen';
import { SettingsScreen } from './containers/SettingsScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<CoreScreen />} />
        <Route path="quests" element={<QuestsScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
