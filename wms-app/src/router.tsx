// @ts-nocheck
import { createBrowserRouter, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { LoginPage } from "./pages/login/LoginPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { TransactionPage } from "./pages/transaction/TransactionPage";
import { StockPage } from "./pages/stock/StockPage";
import { ReportPage } from "./pages/report/ReportPage";
import { HistoryPage } from "./pages/history/HistoryPage";
import { DeliveryPage } from "./pages/delivery/DeliveryPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { path: "/", element: <Navigate to="/dashboard" replace /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/transaction", element: <TransactionPage /> },
      { path: "/stock", element: <StockPage /> },
      { path: "/delivery", element: <DeliveryPage /> },
      { path: "/report", element: <ReportPage /> },
      { path: "/history", element: <HistoryPage /> }
    ]
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />
  }
]);
