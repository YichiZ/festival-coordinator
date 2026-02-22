import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RootLayout } from "@/components/layout/root-layout";
import { HomePage } from "@/pages/home-page";
import { GroupDetailPage } from "@/pages/group-detail-page";
import { CatalogPage } from "@/pages/catalog-page";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
