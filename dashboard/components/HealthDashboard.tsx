"use client";

import { useEffect, useState } from "react";
import type { HistoryPoint, ServiceStatus, SystemStatus } from "@/lib/status";

type Props = {
    initialStatus: SystemStatus;
};

function formatPercent(value: number | null) {
    return value === null ? "n/a" : `${value}%`;
}

function formatGb(used: number | null, total: number | null) {
    if (used === null || total === null) {
        return "n/a";
    }

    return `${used} / ${total} GB`;
}

function formatTemperature(value: number | null) {
    return value === null ? "n/a" : `${value} C`;
}

function formatTimestamp(value: string) {
    return new Intl.DateTimeFormat("de-CH", {
        dateStyle: "short",
        timeStyle: "medium",
    }).format(new Date(value));
}

function statusLabel(status: SystemStatus["overallStatus"]) {
    if (status === "healthy") {
        return "Healthy";
    }
    if (status === "degraded") {
        return "Needs attention";
    }
    return "Offline";
}

function serviceHref(host: string, port: number, suffix = "") {
    return `http://${host}:${port}${suffix}`;
}

function renderMetricLine(
    history: HistoryPoint[],
    key: "cpuUsagePercent" | "memoryUsedPercent" | "diskUsedPercent" | "temperatureC",
) {
    const values = history
        .map((point) => point[key])
        .filter((value): value is number => typeof value === "number");

    if (values.length < 2) {
        return null;
    }

    const maxValue = Math.max(...values, 100);
    const minValue = Math.min(...values, 0);
    const range = Math.max(maxValue - minValue, 1);

    const points = values.map((value, index) => {
        const x = (index / Math.max(values.length - 1, 1)) * 100;
        const y = 100 - ((value - minValue) / range) * 100;
        return `${x},${y}`;
    });

    return (
        <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polyline points={points.join(" ")} />
        </svg>
    );
}

function serviceTone(status: ServiceStatus["status"]) {
    if (status === "online") {
        return "service-online";
    }
    if (status === "degraded") {
        return "service-degraded";
    }
    return "service-offline";
}

export default function HealthDashboard({ initialStatus }: Props) {
    const [status, setStatus] = useState(initialStatus);
    const host =
        typeof window === "undefined" || !window.location.hostname
            ? initialStatus.networkHost
            : window.location.hostname;

    useEffect(() => {
        let cancelled = false;

        const refresh = async () => {
            try {
                const response = await fetch("/api/status", { cache: "no-store" });
                if (!response.ok) {
                    return;
                }

                const nextStatus = (await response.json()) as SystemStatus;
                if (!cancelled) {
                    setStatus(nextStatus);
                }
            } catch {
                // keep the last known values on screen
            }
        };

        const intervalId = window.setInterval(refresh, 15000);
        refresh();

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, []);

    return (
        <main className="shell">
            <section className="hero">
                <div>
                    <p className="eyebrow">Autonomous Homeserver</p>
                    <h1>System health at a glance</h1>
                    <p className="heroText">
                        Container state, host load, temperature and visible issues are
                        refreshed automatically.
                    </p>
                </div>

                <div className={`statusPill status-${status.overallStatus}`}>
                    <span className="statusDot" />
                    {statusLabel(status.overallStatus)}
                </div>
            </section>

            <section className="overviewGrid">
                <article className="metricCard metricCardWide">
                    <p className="metricLabel">Host</p>
                    <h2>{status.hostname}</h2>
                    <p className="metricMeta">Last update: {formatTimestamp(status.timestamp)}</p>
                    <div className="chipRow">
                        <span className="chip">{status.runningContainers} running</span>
                        <span className="chip">{status.totalContainers} total</span>
                        <span className="chip">
                            {status.unhealthyContainers} with issues
                        </span>
                    </div>
                </article>

                <article className="metricCard">
                    <p className="metricLabel">CPU</p>
                    <h2>{formatPercent(status.cpuUsagePercent)}</h2>
                    <p className="metricMeta">{status.cpuModel || "model unavailable"}</p>
                    {renderMetricLine(status.history, "cpuUsagePercent")}
                </article>

                <article className="metricCard">
                    <p className="metricLabel">Memory</p>
                    <h2>{formatPercent(status.memoryUsedPercent)}</h2>
                    <p className="metricMeta">{formatGb(status.memoryUsedGb, status.memoryTotalGb)}</p>
                    {renderMetricLine(status.history, "memoryUsedPercent")}
                </article>

                <article className="metricCard">
                    <p className="metricLabel">Disk</p>
                    <h2>{formatPercent(status.diskUsedPercent)}</h2>
                    <p className="metricMeta">{formatGb(status.diskUsedGb, status.diskTotalGb)}</p>
                    {renderMetricLine(status.history, "diskUsedPercent")}
                </article>

                <article className="metricCard">
                    <p className="metricLabel">Temperature</p>
                    <h2>{formatTemperature(status.temperatureC)}</h2>
                    <p className="metricMeta">Host sensor reading</p>
                    {renderMetricLine(status.history, "temperatureC")}
                </article>
            </section>

            <section className="panelGrid">
                <article className="panel">
                    <div className="panelHeader">
                        <h3>Service reachability</h3>
                        <p>Live checks for the main tools plus direct links.</p>
                    </div>

                    <div className="serviceGrid">
                        {status.services.map((service) => {
                            const href =
                                service.name === "Pi-hole"
                                    ? serviceHref(host, 8081, "/admin")
                                    : service.name === "Portainer"
                                      ? serviceHref(host, 9000)
                                      : serviceHref(host, 8080);

                            return (
                                <a key={service.name} className="serviceCard" href={href}>
                                    <div className={`serviceBadge ${serviceTone(service.status)}`}>
                                        {service.status}
                                    </div>
                                    <strong>{service.name}</strong>
                                    <span>{service.message}</span>
                                    <span className="serviceLatency">
                                        {service.responseTimeMs === null
                                            ? "no latency data"
                                            : `${service.responseTimeMs} ms`}
                                    </span>
                                </a>
                            );
                        })}
                    </div>
                </article>

                <article className="panel">
                    <div className="panelHeader">
                        <h3>Alerts</h3>
                        <p>Things that currently need attention.</p>
                    </div>

                    {status.issues.length === 0 ? (
                        <div className="emptyState okState">No active errors detected.</div>
                    ) : (
                        <ul className="alertList">
                            {status.issues.map((issue) => (
                                <li key={issue}>{issue}</li>
                            ))}
                        </ul>
                    )}
                </article>
            </section>

            <section className="panel">
                <div className="panelHeader">
                    <h3>Containers</h3>
                    <p>Live Docker state from the local Docker socket.</p>
                </div>

                {status.containers.length === 0 ? (
                    <div className="emptyState">
                        No container information available. Check Docker socket access.
                    </div>
                ) : (
                    <div className="tableWrap">
                        <table className="statusTable">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>State</th>
                                    <th>Health</th>
                                    <th>Ports</th>
                                    <th>Uptime</th>
                                </tr>
                            </thead>
                            <tbody>
                                {status.containers.map((container) => (
                                    <tr key={container.name}>
                                        <td>
                                            <strong>{container.name}</strong>
                                            <span className="subCell">{container.image}</span>
                                        </td>
                                        <td>{container.state}</td>
                                        <td>{container.health || "n/a"}</td>
                                        <td>{container.ports.join(", ") || "n/a"}</td>
                                        <td>{container.uptime}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
