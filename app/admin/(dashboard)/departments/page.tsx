import { AdminPageHeader } from "@/components/admin/AdminShell";
import DepartmentManager from "@/components/admin/DepartmentManager";
import { requireAdminPage, roleHasPermission } from "@/lib/auth/guard";
import { currentCsrfToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  const admin = await requireAdminPage("departments:read", "/admin/departments");

  const departments = await prisma.department.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { payments: true } } },
  });

  return (
    <>
      <AdminPageHeader
        title="Departments"
        description="The list students choose from on the payment form."
      />

      <DepartmentManager
        canWrite={roleHasPermission(admin.role, "departments:write")}
        csrf={await currentCsrfToken()}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
          code: department.code,
          active: department.active,
          paymentCount: department._count.payments,
        }))}
      />
    </>
  );
}
