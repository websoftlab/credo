if (__DEV_SERVER__) {
	if (module.hot) {
		module.hot.accept();
		module.hot.addStatusHandler((status) => {
			if (status === 'prepare') console.clear();
		});
	}
}
