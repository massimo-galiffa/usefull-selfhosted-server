import { promises as fs } from "fs";
import path from "path";
import { statfs } from "fs/promises";
import http from "http";

export type ContainerStatus = {
    name: string;
    state: string;
    status: string;
    health: string | null;
    image: string;
    ports: string[];
    uptime: string;
};

export type SystemStatus = {
    hostname: string;
    timestamp: string;
    networkHost: string;
    cpuUsagePercent: number | null;
    cpuModel: string | null;
    memoryUsedPercent: number | null;
    memoryUsedGb: number | null;
    memoryTotalGb: number | null;
    diskUsedPercent: number | null;
    diskUsedGb: number | null;
    diskTotalGb: number | null;
    temperatureC: number | null;
    dockerReachable: boolean;
    runningContainers: number;
    unhealthyContainers: number;
    totalContainers: number;
    overallStatus: "healthy" | "degraded" | "offline";
    issues: string[];
    services: ServiceStatus[];
    history: HistoryPoint[];
    containers: ContainerStatus[];
};

export type ServiceStatus = {
    name: string;
    url: string;
    status: "online" | "degraded" | "offline";
    responseTimeMs: number | null;
    message: string;
};

export type HistoryPoint = {
    timestamp: string;
    cpuUsagePercent: number | null;
    memoryUsedPercent: number | null;
    diskUsedPercent: number | null;
    temperatureC: number | null;
};

type DockerContainerSummary = {
    Id: string;
    Image: string;
    Names?: string[];
    State?: string;
    Status?: string;
    Ports?: Array<{
        IP?: string;
        PrivatePort?: number;
        PublicPort?: number;
        Type?: string;
    }>;
};

type DockerInspect = {
    State?: {
        Status?: string;
        Health?: {
            Status?: string;
        };
        StartedAt?: string;
    };
};

const HOST_PROC = process.env.HOST_PROC_PATH || "/host/proc";
const HOST_SYS = process.env.HOST_SYS_PATH || "/host/sys";
const HOST_ROOT = process.env.HOST_ROOT_PATH || "/host/rootfs";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock";
const DEFAULT_NETWORK_HOST = process.env.NEXT_PUBLIC_SERVER_IP || "localhost";
const HISTORY_FILE = process.env.STATUS_HISTORY_FILE || "/tmp/status-history.json";

function round(value: number, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function bytesToGb(bytes: number) {
    return round(bytes / 1024 / 1024 / 1024, 1);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeReadFile(filePath: string) {
    try {
        return await fs.readFile(filePath, "utf8");
    } catch {
        return null;
    }
}

async function safeWriteFile(filePath: string, contents: string) {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, contents, "utf8");
        return true;
    } catch {
        return false;
    }
}

async function readProcStat() {
    const contents = await safeReadFile(path.join(HOST_PROC, "stat"));
    if (!contents) {
        return null;
    }

    const cpuLine = contents.split("\n").find((line) => line.startsWith("cpu "));
    if (!cpuLine) {
        return null;
    }

    const parts = cpuLine.trim().split(/\s+/).slice(1).map(Number);
    const idle = (parts[3] || 0) + (parts[4] || 0);
    const total = parts.reduce((sum, value) => sum + value, 0);

    return { idle, total };
}

async function getCpuUsagePercent() {
    const first = await readProcStat();
    if (!first) {
        return null;
    }

    await sleep(250);
    const second = await readProcStat();
    if (!second) {
        return null;
    }

    const totalDelta = second.total - first.total;
    const idleDelta = second.idle - first.idle;

    if (totalDelta <= 0) {
        return null;
    }

    return round(((totalDelta - idleDelta) / totalDelta) * 100, 1);
}

async function getCpuModel() {
    const cpuInfo = await safeReadFile(path.join(HOST_PROC, "cpuinfo"));
    if (!cpuInfo) {
        return null;
    }

    const modelLine = cpuInfo
        .split("\n")
        .find((line) => line.toLowerCase().startsWith("model name"));

    return modelLine?.split(":").slice(1).join(":").trim() || null;
}

async function getMemoryStatus() {
    const memInfo = await safeReadFile(path.join(HOST_PROC, "meminfo"));
    if (!memInfo) {
        return {
            memoryUsedPercent: null,
            memoryUsedGb: null,
            memoryTotalGb: null,
        };
    }

    const values = Object.fromEntries(
        memInfo
            .split("\n")
            .filter(Boolean)
            .map((line) => {
                const [key, raw] = line.split(":");
                return [key.trim(), Number.parseInt(raw, 10)];
            }),
    );

    const totalKb = values.MemTotal;
    const availableKb = values.MemAvailable;
    if (!totalKb || !availableKb) {
        return {
            memoryUsedPercent: null,
            memoryUsedGb: null,
            memoryTotalGb: null,
        };
    }

    const usedKb = totalKb - availableKb;

    return {
        memoryUsedPercent: round((usedKb / totalKb) * 100, 1),
        memoryUsedGb: bytesToGb(usedKb * 1024),
        memoryTotalGb: bytesToGb(totalKb * 1024),
    };
}

async function getDiskStatus() {
    try {
        const stats = await statfs(HOST_ROOT);
        const total = stats.bsize * stats.blocks;
        const available = stats.bsize * stats.bavail;
        const used = total - available;

        return {
            diskUsedPercent: total > 0 ? round((used / total) * 100, 1) : null,
            diskUsedGb: bytesToGb(used),
            diskTotalGb: bytesToGb(total),
        };
    } catch {
        return {
            diskUsedPercent: null,
            diskUsedGb: null,
            diskTotalGb: null,
        };
    }
}

async function getTemperatureC() {
    const thermalDir = path.join(HOST_SYS, "class", "thermal");
    const hwmonDir = path.join(HOST_SYS, "class", "hwmon");

    const thermalValue = await readFirstTemperatureFromDir(thermalDir, /^thermal_zone/);
    if (thermalValue !== null) {
        return thermalValue;
    }

    return await readFirstTemperatureFromDir(hwmonDir, /^hwmon/);
}

async function readFirstTemperatureFromDir(baseDir: string, matcher: RegExp) {
    try {
        const entries = await fs.readdir(baseDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory() || !matcher.test(entry.name)) {
                continue;
            }

            const currentDir = path.join(baseDir, entry.name);
            const preferredFiles = ["temp1_input", "temp2_input", "temp3_input"];

            for (const fileName of preferredFiles) {
                const rawValue = await safeReadFile(path.join(currentDir, fileName));
                if (!rawValue) {
                    continue;
                }

                const numericValue = Number.parseInt(rawValue.trim(), 10);
                if (Number.isNaN(numericValue) || numericValue <= 0) {
                    continue;
                }

                return numericValue > 1000 ? round(numericValue / 1000, 1) : round(numericValue, 1);
            }
        }
    } catch {
        return null;
    }

    return null;
}

function dockerGet<T>(pathname: string) {
    return new Promise<T>((resolve, reject) => {
        const request = http.request(
            {
                socketPath: DOCKER_SOCKET,
                path: pathname,
                method: "GET",
            },
            (response) => {
                let body = "";

                response.setEncoding("utf8");
                response.on("data", (chunk) => {
                    body += chunk;
                });
                response.on("end", () => {
                    if (!response.statusCode || response.statusCode >= 400) {
                        reject(new Error(`Docker API ${pathname} failed with ${response.statusCode}`));
                        return;
                    }

                    resolve(JSON.parse(body) as T);
                });
            },
        );

        request.on("error", reject);
        request.end();
    });
}

function formatPorts(container: DockerContainerSummary) {
    return (container.Ports || []).map((port) => {
        if (!port.PublicPort || !port.PrivatePort) {
            return `${port.PrivatePort ?? "?"}/${port.Type ?? "tcp"}`;
        }

        return `${port.PublicPort}->${port.PrivatePort}/${port.Type ?? "tcp"}`;
    });
}

function formatUptime(startedAt?: string) {
    if (!startedAt) {
        return "unknown";
    }

    const started = new Date(startedAt);
    if (Number.isNaN(started.getTime())) {
        return "unknown";
    }

    const diffMs = Date.now() - started.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) {
        return "just started";
    }
    if (diffMinutes < 60) {
        return `${diffMinutes} min`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
        return `${diffHours} h`;
    }

    return `${Math.floor(diffHours / 24)} d`;
}

async function checkService(
    name: string,
    url: string,
    expectedStatus: number[] = [200, 301, 302, 307, 308],
): Promise<ServiceStatus> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const responseTimeMs = Date.now() - startedAt;
        const ok = expectedStatus.includes(response.status);

        return {
            name,
            url,
            status: ok ? "online" : "degraded",
            responseTimeMs,
            message: ok ? `HTTP ${response.status}` : `Unexpected HTTP ${response.status}`,
        };
    } catch {
        clearTimeout(timeoutId);
        return {
            name,
            url,
            status: "offline",
            responseTimeMs: null,
            message: "No response",
        };
    }
}

async function getServiceStatuses() {
    return Promise.all([
        checkService("Dashboard", "http://127.0.0.1:3000/"),
        checkService("Pi-hole", "http://pihole/admin/"),
        checkService("Portainer", "http://portainer:9000/"),
    ]);
}

async function readHistory(): Promise<HistoryPoint[]> {
    const raw = await safeReadFile(HISTORY_FILE);
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as HistoryPoint[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeHistoryIfNeeded(historyPoint: HistoryPoint) {
    const existing = await readHistory();
    const last = existing.at(-1);

    if (last) {
        const lastTime = new Date(last.timestamp).getTime();
        const currentTime = new Date(historyPoint.timestamp).getTime();

        if (currentTime - lastTime < 60_000) {
            return existing.slice(-48);
        }
    }

    const next = [...existing, historyPoint].slice(-48);
    await safeWriteFile(HISTORY_FILE, JSON.stringify(next));
    return next;
}

async function getDockerContainers() {
    try {
        const containers = await dockerGet<DockerContainerSummary[]>("/containers/json?all=true");
        const detailed = await Promise.all(
            containers.map(async (container) => {
                let inspect: DockerInspect | null = null;

                try {
                    inspect = await dockerGet<DockerInspect>(`/containers/${container.Id}/json`);
                } catch {
                    inspect = null;
                }

                return {
                    name: container.Names?.[0]?.replace(/^\//, "") || container.Id.slice(0, 12),
                    state: inspect?.State?.Status || container.State || "unknown",
                    status: container.Status || "unknown",
                    health: inspect?.State?.Health?.Status || null,
                    image: container.Image,
                    ports: formatPorts(container),
                    uptime: formatUptime(inspect?.State?.StartedAt),
                } satisfies ContainerStatus;
            }),
        );

        return {
            dockerReachable: true,
            containers: detailed.sort((left, right) => left.name.localeCompare(right.name)),
        };
    } catch {
        return {
            dockerReachable: false,
            containers: [] as ContainerStatus[],
        };
    }
}

async function getHostname() {
    const contents = await safeReadFile(path.join(HOST_PROC, "sys", "kernel", "hostname"));
    return contents?.trim() || "homeserver";
}

export async function getSystemStatus(): Promise<SystemStatus> {
    const [hostname, cpuUsagePercent, cpuModel, memory, disk, temperatureC, docker, services] =
        await Promise.all([
            getHostname(),
            getCpuUsagePercent(),
            getCpuModel(),
            getMemoryStatus(),
            getDiskStatus(),
            getTemperatureC(),
            getDockerContainers(),
            getServiceStatuses(),
        ]);

    const issues: string[] = [];
    const runningContainers = docker.containers.filter((container) => container.state === "running").length;
    const unhealthyContainers = docker.containers.filter(
        (container) =>
            container.health === "unhealthy" ||
            container.state === "exited" ||
            container.state === "dead",
    ).length;

    if (!docker.dockerReachable) {
        issues.push("Docker socket is not reachable from the dashboard.");
    }

    const downServices = services.filter((service) => service.status !== "online");
    if (downServices.length > 0) {
        issues.push(`${downServices.length} service endpoint(s) are not responding normally.`);
    }

    if (unhealthyContainers > 0) {
        issues.push(`${unhealthyContainers} container(s) need attention.`);
    }

    if ((memory.memoryUsedPercent ?? 0) >= 90) {
        issues.push("RAM usage is above 90%.");
    }

    if ((disk.diskUsedPercent ?? 0) >= 90) {
        issues.push("Disk usage is above 90%.");
    }

    if ((temperatureC ?? 0) >= 85) {
        issues.push("Device temperature is critical.");
    }

    let overallStatus: SystemStatus["overallStatus"] = "healthy";
    if (!docker.dockerReachable) {
        overallStatus = "offline";
    } else if (issues.length > 0) {
        overallStatus = "degraded";
    }

    const timestamp = new Date().toISOString();
    const history = await writeHistoryIfNeeded({
        timestamp,
        cpuUsagePercent,
        memoryUsedPercent: memory.memoryUsedPercent,
        diskUsedPercent: disk.diskUsedPercent,
        temperatureC,
    });

    return {
        hostname,
        timestamp,
        networkHost: DEFAULT_NETWORK_HOST,
        cpuUsagePercent,
        cpuModel,
        memoryUsedPercent: memory.memoryUsedPercent,
        memoryUsedGb: memory.memoryUsedGb,
        memoryTotalGb: memory.memoryTotalGb,
        diskUsedPercent: disk.diskUsedPercent,
        diskUsedGb: disk.diskUsedGb,
        diskTotalGb: disk.diskTotalGb,
        temperatureC,
        dockerReachable: docker.dockerReachable,
        runningContainers,
        unhealthyContainers,
        totalContainers: docker.containers.length,
        overallStatus,
        issues,
        services,
        history,
        containers: docker.containers,
    };
}
