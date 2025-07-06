import fs from "node:fs";

export class ArgsParser {
	#args;
	#required;
	#flags;
	#envArgs;
	#helpMsg;

	/**
	 *
	 * @param {Array<{ name: string, desc: string, required?: true, envName?: string, flag?: true }>} args
	 * @param {{ title: string, usage: string }} help
	 */
	constructor(args, help) {
		this.#flags = [];
		this.#required = [];
		this.#args = [];
		this.#envArgs = [];
		this.#helpMsg = help.title + "\n" + help.usage + "\n" + "Usage:";

		args.forEach((arg) => {
			this.#args.push(arg.name);
			this.#helpMsg += `\n--${arg} `;

			if (arg.envName) {
				this.#envArgs.push([arg.envName, arg.name]);
				this.#helpMsg += `| env: ${arg.envName} `;
			}

			if (arg.required) {
				this.#required.push(arg.name);
				this.#helpMsg += "(required)";
			}

			if (arg.flag) {
				this.#flags.push(arg.name);
			}

			this.#helpMsg += "\t" + arg.desc + "\n";
		});
	}

	#loadDotEnv() {
		const envArgs = {};
		try {
			const content = fs.readFileSync(".env", "utf-8");
			for (const line of content.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) {
					continue;
				}

				const [key, value] = trimmed.split("=");
				const trimmedKey = key.trim();

				if (trimmedKey) {
					if (this.#flags.includes(trimmedKey)) {
						envArgs[trimmedKey] = true;
					} else {
						envArgs[trimmedKey] = value.replace(/^['"]$/g, "").trim();
					}
				}
			}
		} catch {
			// silently ignore
		}
		return envArgs;
	}

	#parseCli(params) {
		const args = {};

		for (const param of params) {
			const stripped = param.slice(2); // strip --
			const [key, value] = stripped.split("=", 2);

			if (this.#flags.includes(key)) {
				args[key] = true;
			} else {
				args[key] = value;
			}
		}

		return args;
	}

	help() {
		return this.#helpMsg;
	}

	parse(args) {
		const env = process.env;
		const dot = this.#loadDotEnv();
		const cli = this.#parseCli(args);

		const params = this.#args.reduce((curr, param) => {
			curr[param] = cli[param];
			return curr;
		}, {});

		this.#envArgs.forEach(([envParam, cliParam]) => {
			if (params[cliParam] === undefined) {
				params[cliParam] = dot[envParam] || env[envParam];
			}
		});

		// clean undefined
		for (const param in params) {
			if (params[param] === undefined) {
				delete params[param];
			}
		}

		return params;
	}

	validate(params) {
		const errors = [];
		const warnings = [];

		this.#required.forEach((required) => {
			if (params[required] === undefined) {
				errors.push({ param: required, msg: `Required param \`${required}\` was not provided` });
			}
		});

		for (const param in params) {
			if (!this.#args.includes(param)) {
				warnings.push({ param: param, msg: `Unknown param \`${param}}\` found` });
			}
		}

		return { errors, warnings };
	}
}
