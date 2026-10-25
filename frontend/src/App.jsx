import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import ErrorBoundary from "./components/ErrorBoundary";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PasswordResetRequest from "./pages/PasswordResetRequest";
import PasswordResetConfirm from "./pages/PasswordResetConfirm";
import EmailVerification from "./pages/EmailVerification";
import Feed from "./pages/Feed";
import JobList from "./pages/JobList";
import JobDetail from "./pages/JobDetail";
import CreateJob from "./pages/CreateJob";
import JobApplications from "./pages/JobApplications";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Network from "./pages/Network";
import Messages from "./pages/Messages";
import PeopleSearch from "./pages/PeopleSearch";
import ResumeAnalysis from "./pages/ResumeAnalysis";
import Landing from "./pages/Landing";
import Search from "./pages/Search";
import Notifications from "./pages/Notifications";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Navbar />
          <ErrorBoundary>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<PasswordResetRequest />} />
              <Route path="/reset-password" element={<PasswordResetConfirm />} />
              <Route path="/verify-email" element={<EmailVerification />} />
              <Route path="/" element={<Landing />} />

              {/* Protected – unified access for all members */}
              <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/jobs" element={<ProtectedRoute><JobList /></ProtectedRoute>} />
              <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
              <Route path="/jobs/new" element={<ProtectedRoute><CreateJob /></ProtectedRoute>} />
              <Route path="/jobs/:id/applications" element={<ProtectedRoute><JobApplications /></ProtectedRoute>} />
              <Route path="/candidates" element={<ProtectedRoute><PeopleSearch /></ProtectedRoute>} />
              <Route path="/people" element={<ProtectedRoute><PeopleSearch /></ProtectedRoute>} />
              <Route path="/resume-analysis" element={<ProtectedRoute><ResumeAnalysis /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/edit" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
              <Route path="/network" element={<ProtectedRoute><Network /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/message" element={<Navigate to="/messages" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/feed" replace />} />
            </Routes>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
