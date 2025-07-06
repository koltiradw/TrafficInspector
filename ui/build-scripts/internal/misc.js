export const debounce = (cb, timeout, instantCb) => {
	let lastCallArgs;
	let timeoutID;

	return (...args) => {
		lastCallArgs = args;
		if (timeoutID) {
			clearTimeout(timeoutID);
		}

		timeoutID = setTimeout(cb, timeout, ...lastCallArgs);
		instantCb?.(...lastCallArgs);
	};
};
