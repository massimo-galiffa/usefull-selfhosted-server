import HealthDashboard from "@/components/HealthDashboard";
import { getSystemStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function Home() {
    const status = await getSystemStatus();
    return <HealthDashboard initialStatus={status} />;
}
