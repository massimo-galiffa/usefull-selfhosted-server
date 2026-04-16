import ServiceCard from "../components/ServiceCard";

const SERVER_IP = process.env.NEXT_PUBLIC_SERVER_IP || "192.168.1.100";

export default function Home() {
    return (
        <main style={{ padding: 40 }}>
            <h1>Homeserver Dashboard</h1>

            <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
                <ServiceCard
                    title="Pi-hole"
                    description="DNS Filter"
                    href={`http://${SERVER_IP}:8081/admin`}
                />

                <ServiceCard
                    title="Portainer"
                    description="Docker Verwaltung"
                    href={`http://${SERVER_IP}:9000`}
                />

                <ServiceCard
                    title="Minecraft"
                    description="Game Server"
                    href="#"
                />
            </div>
        </main>
    );
}