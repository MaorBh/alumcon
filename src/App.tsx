import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import MobileGate from "./components/MobileGate";
import RequireAuth from "./components/RequireAuth";
import { AuthProvider } from "./auth/AuthContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Items from "./pages/Items";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ScanLogin from "./pages/scan/ScanLogin";
import ScanInstall from "./pages/scan/ScanInstall";
import StationScan from "./pages/scan/StationScan";
import QcScan from "./pages/scan/QcScan";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public auth route */}
            <Route path="/login" element={<Login />} />

            {/* Mobile scanner app - separate auth flow */}
            <Route path="/scan/login" element={<ScanLogin />} />
            <Route path="/scan/install" element={<ScanInstall />} />
            <Route path="/scan/station" element={<StationScan />} />
            <Route path="/scan/qc" element={<QcScan />} />

            {/* Main admin app - protected */}
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/projects/:id" element={<ProjectDetail />} />
                      <Route path="/items" element={<Items />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AppLayout>
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
