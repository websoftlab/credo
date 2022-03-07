import type {Cron, CredoJSCron} from "../types";
import schedule from "node-schedule";

// cron

const createJob = (credo: CredoJSCron, conf: Cron.Job | Cron.Service, part: number) => {
	const isJob = (conf: any): conf is Cron.Job => typeof conf.job === "function";
	const {rule} = conf;

	let {name} = conf;
	let started: number = 0;
	let completed: number = 0;
	let errors: number = 0;
	let job: schedule.Job;
	let work: (this: any, date: Date) => Promise<void>;

	if(!name) {
		name = `@cron-part-${part}/${Math.random().toString(16).substring(2)}`;
	}

	if(credo.cron[name]) {
		credo.debug.error(`Duplicate cron job name {cyan %s}, ignore job`, name);
		return () => {};
	}

	const sJob = (date: Date) => {
		credo.debug.cron(`Cron job {cyan %s} started`, name);
		started ++;
		work
			.call(jobWork, date)
			.then(() => {
				completed ++;
			})
			.catch((err: Error) => {
				errors ++;
				credo.debug.error(`Cron job {cyan %s} failure`, name, err);
			})
			.finally(() => {
				credo.debug.cron(`Cron job {cyan %s} completed`, name);
			});
	};

	const jobWork: Cron.Worker = {
		get name() { return name as string; },
		get job() { return job; },
		get started() { return started; },
		get completed() { return completed; },
		get errors() { return errors; },
	};

	if(isJob(conf)) {
		const {job} = conf;
		work = async function(this: any, date: Date) {
			return job.call(this, date);
		};
	} else {
		const {service, args = []} = conf;
		const [name, method] = String(service).split(".");
		work = async function(this: any, date: Date) {
			const copy = args.slice();
			copy.push(date);
			return method
				? credo.services[name][method].apply(this, copy)
				: credo.services[name].apply(this, copy);
		};
	}

	job = schedule.scheduleJob(rule, (date) => {
		sJob.call(jobWork, date);
	});

	credo.cron[name] = jobWork;

	return sJob;
};

export default async function nodeSchedule(credo: CredoJSCron, jobs: Array<Cron.Job | Cron.Service>) {
	for(let i = 0; i < jobs.length; i++) {
		const conf = jobs[i];
		const {bootstrap = false} = conf;
		const fire = createJob(credo, conf, i + 1);
		if(bootstrap) {
			fire(new Date());
		}
	}
}