const logRank = {
	debug: 0,
	info: 1,
	log: 1,
	table: 1,
	warning: 2,
	error: 3,
};

export class Logger {
	log_level;
	prefix;
	rank;

	constructor(log_level = "info") {
		this.log_level = log_level;
		this.prefix = "[dev server]";
		this.rank = logRank;
	}

	log(msg, icon = "", sev = "info") {
		if (logRank[this.log_level] <= logRank[sev]) {
			let str = this.prefix + "\t";

			if (icon.length > 0) {
				str += `${icon}\t${msg}`;
			} else {
				str += msg;
			}

			console[sev](str);
		}
	}
}
