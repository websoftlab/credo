export interface DaemonOptions {
	delay: number;
	cpuPoint: number;
	killSignal: string;
	pid: string;
}

export interface DaemonCPUValue {
	t: number; // time
	s: number; // system
	u: number; // user
	c: number; // seconds
	n: number; // nanoseconds
}

interface DaemonProcDetail {
	id: string;
	part: number;
	type: "main" | "cluster" | "fork" | "worker";
	mode: null | "app" | "cron";
	port: null | number;
	host: null | string;
}

export interface DaemonCPU extends DaemonProcDetail {
	pid: number;
	restarted: number;
	cpu: DaemonCPUValue[];
}

export interface DaemonPIDFileData {
	pid: number;
	start: number;
	latest: number;
	end: number;
	lastError: string | null;
	cpu: Record<string, DaemonCPU>;
}

interface CD {
	cid: number;
	pid: number;
}

export interface DaemonSendRestart extends CD {
	type: "restart";
	id: string;
	part: number;
}

export interface DaemonSendCPU extends DaemonProcDetail, CD {
	cpu: DaemonCPUValue;
}

export interface DaemonSendSetDetail extends Omit<DaemonProcDetail, "type">, CD {
	type: "detail";
}

export type DaemonSendData = DaemonSendRestart | DaemonSendCPU | DaemonSendSetDetail;
