import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { AccessDenied } from './pages/AccessDenied';
import { Home } from './pages/Home';
import { MyData } from './pages/placeholder/MyData';
import { Members } from './pages/placeholder/Members';
import { MemberDetail } from './pages/MemberDetail';
import { Leadership } from './pages/placeholder/Leadership';
import { CalendarPage } from './pages/placeholder/CalendarPage';
import { Stories } from './pages/placeholder/Stories';
import { StoryDetail } from './pages/StoryDetail';
import { Bulletins } from './pages/placeholder/Bulletins';
import { BulletinDetail } from './pages/BulletinDetail';
import { Selfies } from './pages/placeholder/Selfies';
import { Message } from './pages/placeholder/Message';
import { Sponsors } from './pages/placeholder/Sponsors';
import { ClubInfo } from './pages/placeholder/ClubInfo';
import { Birthdays } from './pages/placeholder/Birthdays';
import { Settings } from './pages/Settings';
import { AddEvent } from './pages/placeholder/admin/AddEvent';
import { AttendancePlans } from './pages/AttendancePlans';
import { Attendance } from './pages/placeholder/admin/Attendance';
import { ManageMembers } from './pages/placeholder/admin/ManageMembers';
import { StoryForm } from './pages/admin/StoryForm';
import { BulletinForm } from './pages/admin/BulletinForm';
import { PublicStory } from './pages/PublicStory';
import { PublicBulletin } from './pages/PublicBulletin';
import { ReferSomeone } from './pages/ReferSomeone';
import { EZLeads } from './pages/admin/EZLeads';
import { LeadDetail } from './pages/admin/LeadDetail';
import { ProspectiveMembers } from './pages/ProspectiveMembers';
import { DepositIdeas } from './pages/DepositIdeas';
import { LeadershipActions } from './pages/admin/LeadershipActions';
import { Fundraiser } from './pages/placeholder/admin/Fundraiser';
import { ProfileHub } from './pages/hubs/ProfileHub';
import { ClubHub } from './pages/hubs/ClubHub';
import { ConnectGrowHub } from './pages/hubs/ConnectGrowHub';
import { ServiceGalleryHub } from './pages/hubs/ServiceGalleryHub';
import { Suggestions } from './pages/Suggestions';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/profile-hub" element={<ProtectedRoute><ProfileHub /></ProtectedRoute>} />
          <Route path="/club-hub" element={<ProtectedRoute><ClubHub /></ProtectedRoute>} />
          <Route path="/connect-grow" element={<ProtectedRoute><ConnectGrowHub /></ProtectedRoute>} />
          <Route path="/service-gallery" element={<ProtectedRoute><ServiceGalleryHub /></ProtectedRoute>} />
          <Route path="/suggestions" element={<ProtectedRoute><Suggestions /></ProtectedRoute>} />
          <Route path="/my-data" element={<ProtectedRoute><MyData /></ProtectedRoute>} />
          <Route path="/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
          <Route path="/members/:id" element={<ProtectedRoute><MemberDetail /></ProtectedRoute>} />
          <Route path="/leadership" element={<ProtectedRoute><Leadership /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/stories" element={<ProtectedRoute><Stories /></ProtectedRoute>} />
          <Route path="/stories/:slug" element={<ProtectedRoute><StoryDetail /></ProtectedRoute>} />
          <Route path="/bulletins" element={<ProtectedRoute><Bulletins /></ProtectedRoute>} />
          <Route path="/bulletins/:slug" element={<ProtectedRoute><BulletinDetail /></ProtectedRoute>} />
          <Route path="/selfies" element={<ProtectedRoute><Selfies /></ProtectedRoute>} />
          <Route path="/message" element={<ProtectedRoute><Message /></ProtectedRoute>} />
          <Route path="/sponsors" element={<ProtectedRoute><Sponsors /></ProtectedRoute>} />
          <Route path="/club-info" element={<ProtectedRoute><ClubInfo /></ProtectedRoute>} />
          <Route path="/birthdays" element={<ProtectedRoute><Birthdays /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/refer" element={<ProtectedRoute><ReferSomeone /></ProtectedRoute>} />
          <Route path="/prospective-members" element={<ProtectedRoute requireLeader><ProspectiveMembers /></ProtectedRoute>} />
          <Route path="/attendance-plans" element={<ProtectedRoute><AttendancePlans /></ProtectedRoute>} />
          <Route path="/deposit-ideas" element={<ProtectedRoute><DepositIdeas /></ProtectedRoute>} />

          <Route path="/leads" element={<ProtectedRoute requireLeader><EZLeads /></ProtectedRoute>} />
          <Route path="/leads/:id" element={<ProtectedRoute requireLeader><LeadDetail /></ProtectedRoute>} />

          <Route path="/admin/add-event" element={<ProtectedRoute requireLeader><AddEvent /></ProtectedRoute>} />
          <Route path="/admin/leadership-actions" element={<ProtectedRoute requireLeader><LeadershipActions /></ProtectedRoute>} />
          <Route path="/admin/fundraiser" element={<ProtectedRoute requireLeader><Fundraiser /></ProtectedRoute>} />
          <Route path="/admin/attendance" element={<ProtectedRoute requireLeader><Attendance /></ProtectedRoute>} />
          <Route path="/admin/members" element={<ProtectedRoute requireAdmin><ManageMembers /></ProtectedRoute>} />
          <Route path="/admin/stories/new" element={<ProtectedRoute requireAdmin><StoryForm /></ProtectedRoute>} />
          <Route path="/admin/stories/:slug" element={<ProtectedRoute requireAdmin><StoryForm /></ProtectedRoute>} />
          <Route path="/admin/bulletins/new" element={<ProtectedRoute requireAdmin><BulletinForm /></ProtectedRoute>} />
          <Route path="/admin/bulletins/:slug" element={<ProtectedRoute requireAdmin><BulletinForm /></ProtectedRoute>} />

          <Route path="/share/story/:slug" element={<PublicStory />} />
          <Route path="/share/bulletin/:slug" element={<PublicBulletin />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
