import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/layout/RequireAuth';
import { RequirePlan } from './components/layout/RequirePlan';
import { Landing } from './routes/Landing';
import { SignUp } from './routes/SignUp';
import { SignIn } from './routes/SignIn';
import { Onboarding } from './routes/Onboarding';
import { Dashboard } from './routes/Dashboard';
import { TrainingPlan } from './routes/TrainingPlan';
import { CrewPlan } from './routes/CrewPlan';
import { SharedPlans } from './routes/SharedPlans';
import { LogRun } from './routes/LogRun';
import { Partners } from './routes/Partners';
import { Run } from './routes/Run';
import { Chat } from './routes/Chat';
import { Profile } from './routes/Profile';

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/signin" element={<SignIn />} />

        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/shared-plans" element={<SharedPlans />} />
          <Route path="/crew-plan/shared/:planId" element={<CrewPlan />} />

          <Route element={<RequirePlan />}>
            <Route element={<AppLayout />}>
              <Route path="/home" element={<Dashboard />} />
              <Route path="/training-plan" element={<TrainingPlan />} />
              <Route path="/crew-plan" element={<CrewPlan />} />
              <Route path="/log-run" element={<LogRun />} />
              <Route path="/partners" element={<Partners />} />
              <Route path="/run" element={<Run />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  );
}
