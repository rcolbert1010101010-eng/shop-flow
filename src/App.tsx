import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Units from "@/pages/Units";
import UnitForm from "@/pages/UnitForm";
import Vendors from "@/pages/Vendors";
import VendorDetail from "@/pages/VendorDetail";
import Categories from "@/pages/Categories";
import CategoryDetail from "@/pages/CategoryDetail";
import Inventory from "@/pages/Inventory";
import PartForm from "@/pages/PartForm";
import ManufacturingProductsPage from "@/pages/manufacturing/ProductsPage";
import ManufacturingProductFormPage from "@/pages/manufacturing/ProductFormPage";
import SalesOrders from "@/pages/SalesOrders";
import SalesOrderDetail from "@/pages/SalesOrderDetail";
import ManufacturingBuildsPage from "@/pages/manufacturing/BuildsPage";
import ManufacturingBuildFormPage from "@/pages/manufacturing/BuildFormPage";
import WorkOrders from "@/pages/WorkOrders";
import WorkOrderDetail from "@/pages/WorkOrderDetail";
import PurchaseOrders from "@/pages/PurchaseOrders";
import PurchaseOrderDetail from "@/pages/PurchaseOrderDetail";
import Technicians from "@/pages/Technicians";
import TechnicianDetail from "@/pages/TechnicianDetail";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import PaymentsPage from "@/pages/Payments";
import CycleCounts from "@/pages/CycleCounts";
import CycleCountDetail from "@/pages/CycleCountDetail";
import Returns from "@/pages/Returns";
import ReturnDetail from "@/pages/ReturnDetail";
import WarrantyClaims from "@/pages/WarrantyClaims";
import WarrantyClaimDetail from "@/pages/WarrantyClaimDetail";
import ReturnsWarrantyReport from "@/pages/ReturnsWarrantyReport";
import PlasmaProjects from "@/pages/PlasmaProjects";
import PlasmaProjectDetail from "@/pages/PlasmaProjectDetail";
import PlasmaPrint from "@/pages/PlasmaPrint";
import PlasmaTemplates from "@/pages/PlasmaTemplates";
import PlasmaTemplateDetail from "@/pages/PlasmaTemplateDetail";
import Scheduling from "@/pages/Scheduling";
import ReceiveInventory from "@/pages/ReceiveInventory";
import ReceivingHistory from "@/pages/ReceivingHistory";
import ReceivingReceiptDetail from "@/pages/ReceivingReceiptDetail";
import InvoiceDetail from "@/pages/InvoiceDetail";
import InvoiceRegistry from "@/pages/InvoiceRegistry";
import ReportsHome from "@/pages/Reports";
import WorkInProcessReport from "@/pages/reports/WorkInProcessReport";
import WorkOrdersWaitingPartsReport from "@/pages/reports/WorkOrdersWaitingPartsReport";
import WorkOrdersReport from "@/pages/reports/WorkOrdersReport";
import SalesOrdersReport from "@/pages/reports/SalesOrdersReport";
import LowStockPartsReport from "@/pages/reports/LowStockPartsReport";
import WorkOrderPrintOverview from "@/pages/print/WorkOrderPrintOverview";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/print/work-orders/:id" element={<WorkOrderPrintOverview />} />
            <Route element={<MainLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/units" element={<Units />} />
              <Route path="/units/:id" element={<UnitForm />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/vendors/:id" element={<VendorDetail />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/categories/:id" element={<CategoryDetail />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/receiving" element={<ReceiveInventory />} />
              <Route path="/receiving-history" element={<ReceivingHistory />} />
              <Route path="/receiving-history/:id" element={<ReceivingReceiptDetail />} />
              <Route path="/inventory/:id" element={<PartForm />} />
              <Route path="/manufacturing/products" element={<ManufacturingProductsPage />} />
              <Route path="/manufacturing/products/new" element={<ManufacturingProductFormPage />} />
              <Route path="/manufacturing/products/:id" element={<ManufacturingProductFormPage />} />
              <Route path="/manufacturing/builds" element={<ManufacturingBuildsPage />} />
              <Route path="/manufacturing/builds/new" element={<ManufacturingBuildFormPage />} />
              <Route path="/manufacturing/builds/:id" element={<ManufacturingBuildFormPage />} />
              <Route path="/sales-orders" element={<SalesOrders />} />
              <Route path="/sales-orders/:id" element={<SalesOrderDetail />} />
              <Route path="/plasma" element={<PlasmaProjects />} />
              <Route path="/plasma/:id" element={<PlasmaProjectDetail />} />
              <Route path="/plasma/:id/print" element={<PlasmaPrint />} />
              <Route path="/plasma/templates" element={<PlasmaTemplates />} />
              <Route path="/plasma/templates/:id" element={<PlasmaTemplateDetail />} />
              <Route path="/work-orders" element={<WorkOrders />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
              <Route path="/invoices" element={<InvoiceRegistry />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/scheduling" element={<Scheduling />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
              <Route path="/returns" element={<Returns />} />
              <Route path="/returns/:id" element={<ReturnDetail />} />
              <Route path="/warranty" element={<WarrantyClaims />} />
              <Route path="/warranty/:id" element={<WarrantyClaimDetail />} />
              <Route path="/reports" element={<ReportsHome />} />
              <Route path="/reports/returns-warranty" element={<ReturnsWarrantyReport />} />
              <Route path="/reports/work-in-process" element={<WorkInProcessReport />} />
              <Route path="/reports/work-orders-waiting-parts" element={<WorkOrdersWaitingPartsReport />} />
              <Route path="/reports/work-orders" element={<WorkOrdersReport />} />
              <Route path="/reports/sales-orders" element={<SalesOrdersReport />} />
              <Route path="/reports/low-stock" element={<LowStockPartsReport />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/cycle-counts" element={<CycleCounts />} />
              <Route path="/cycle-counts/:id" element={<CycleCountDetail />} />
              <Route path="/technicians" element={<Technicians />} />
              <Route path="/technicians/:id" element={<TechnicianDetail />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
