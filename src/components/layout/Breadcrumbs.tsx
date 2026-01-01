import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

// Route configuration with titles and parent relationships
const routeConfig: Record<string, { title: string; parent?: string }> = {
  // Hoy
  "/start-day": { title: "Inicio del Día", parent: "/dashboard" },
  "/tasks": { title: "Tareas", parent: "/dashboard" },
  "/logs": { title: "Logs", parent: "/dashboard" },
  "/calendar": { title: "Calendario", parent: "/dashboard" },
  
  // Progreso
  "/analytics": { title: "Analytics", parent: "/dashboard" },
  "/challenges": { title: "Retos", parent: "/dashboard" },
  
  // Módulos
  "/ai-news": { title: "Noticias IA", parent: "/dashboard" },
  "/nutrition": { title: "Nutrición", parent: "/dashboard" },
  "/finances": { title: "Finanzas", parent: "/dashboard" },
  "/bosco": { title: "Bosco", parent: "/dashboard" },
  "/content": { title: "Contenido", parent: "/dashboard" },
  
  // Academias
  "/ai-course": { title: "Curso IA", parent: "/dashboard" },
  "/coach": { title: "Coach", parent: "/dashboard" },
  "/english": { title: "Inglés", parent: "/dashboard" },
  
  // Sistema
  "/dashboard": { title: "Dashboard" },
  "/settings": { title: "Ajustes", parent: "/dashboard" },
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Get route info
  const currentRoute = routeConfig[currentPath];
  
  // If route not found or is dashboard, don't show breadcrumbs
  if (!currentRoute || currentPath === "/dashboard") {
    return null;
  }
  
  // Build breadcrumb trail
  const trail: Array<{ path: string; title: string }> = [];
  
  // Add parent if exists
  if (currentRoute.parent) {
    const parentRoute = routeConfig[currentRoute.parent];
    if (parentRoute) {
      trail.push({ path: currentRoute.parent, title: parentRoute.title });
    }
  }
  
  // Add current page
  trail.push({ path: currentPath, title: currentRoute.title });
  
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;
          
          return (
            <div key={item.path} className="flex items-center">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.path} className="hover:text-foreground transition-colors">
                      {item.title}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
