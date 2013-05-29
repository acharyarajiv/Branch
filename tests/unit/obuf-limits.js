exports.Obuf_limits = (function () {
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	obuf_limits = {},
	name = 'Obuf-limits',
	client = '',
	tester = {},
	server_pid = '',
	all_tests = '',
	server_port = '',
	server_host = '',
	client_pid = '';

	obuf_limits.debug_mode = false;

	obuf_limits.start_test = function (cpid, callback) {
		testEmitter.on('start', function () {
			var tags = 'obuf_limits',
			overrides = {},
			args = {};
			args['name'] = name;
			args['tags'] = tags;
			overrides['slave-read-only'] = 'no';
			args['overrides'] = overrides;
			server.start_server(client_pid, args, function (err, res) {
				if (err) {
					callback(err, null);
				}
				server_pid = res;
				client = g.srv[client_pid][server_pid]['client'];
				server_host = g.srv[client_pid][server_pid]['host'];
				server_port = g.srv[client_pid][server_pid]['port'];
				all_tests = Object.keys(tester);

				testEmitter.emit('next');
			});
		});
		testEmitter.on('end', function () {
			server.kill_server(client_pid, server_pid, function (err, res) {
				if (err) {
					callback(err, null);
				}
				callback(null, true);
			});
		});
		testEmitter.on('next', function () {
			var test_case_name = all_tests.shift()
				if (test_case_name) {
					tester[test_case_name](function (error) {
						ut.fail(error);
						testEmitter.emit('next');
					});
				} else {
					client.end();
					if (obuf_limits.debug_mode) {
						log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
					}
					testEmitter.emit('end');
				}
		});
		if (obuf_limits.debug_mode) {
			server.set_debug_mode(true);
		}
		testEmitter.emit('start');
	}

	//UnStable
	tester.obuf_limits1 = function (errorCallback) {
		var test_case = 'Client output buffer hard limit is enforced';
		client.config('set', 'client-output-buffer-limit', 'pubsub 100000 0 0', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			var newClient = redis.createClient(server_port, server_host);
			newClient.subscribe('foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				var i = 0,
				omem = 0;
				try {
					if (!assert.ok(ut.match(res, 'subscribe foo 1'), test_case)) {
						/*
						 * send 3300 publish command at once without waiting for reply
						 * get the client list properties
						 * and check for omem value
						 * This tweak is implemented since the async calls made by publish and client list commands,
						 * give enough time for redis to read and clear the output buffer and hence neither omem nor obl value
						 * increase. Instead of waiting for reply on publish and then publishing again after the reply
						 * 3300(random number picked after trail and error method) publish commands are sent which are queued
						 * in buffer memory and thus causing increasing in OBL and omem properties
						 */
						g.asyncFor(0, -1, function (loop) {

							//reading client list
							client.client('list', function (err, res) {
								clients = res.split('\n');
								if (clients[1]) {
									c = clients[1].split(' ');
									omem = c[13].split('=')[1];

									if (omem <= 200000) {
										i = 0;
										//3300(random number picked after trail and error method) publish commands are sent
										//without waiting for reply
										while (i < 3200) {
											client.publish('foo', 'bar');
											i++;
										}
										loop.next();
									} else
										loop.break();
								} else
									loop.break();
							});
						}, function () {
							if (omem >= 99000 && omem < 200000)
								ut.pass(test_case);
							else
								ut.fail('Client output buffer hard limit is not enforced', true);
							testEmitter.emit('next');
						});
					}
				} catch (e) {
					ut.fail(e, true);
					testEmitter.emit('next');
				}
			});
		});
	}

	//UnStable
	tester.obuf_limits2 = function (errorCallback) {
		var test_case = 'Client output buffer soft limit is not enforced if time is not overreached';
		var i = 0,
		start_time = 0,
		time_elapsed = 0,
		omem = 0;
		client.config('set', 'client-output-buffer-limit', 'pubsub 0 100000 10', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			var newClient = redis.createClient(server_port, server_host);
			newClient.subscribe('foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				try {
					if (!assert.ok(ut.match(res, 'subscribe foo 1'), test_case)) {
						/*
						 * send 3200 publish command at once without waiting for reply
						 * get the client list properties
						 * and check for omem value
						 * This tweak is implemented since the async calls made by publish and client list commands,
						 * give enough time for redis to read and clear the output buffer and hence neither omem nor obl value
						 * increase. Instead of waiting for reply on publish and then publishing again after the reply
						 * 3200(random number picked after trail and error method) publish commands are sent which are queued
						 * in buffer memory and thus causing increasing in OBL and omem properties
						 */
						g.asyncFor(0, -1, function (loop) {
							client.client('list', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								clients = res.split('\n');
								if (clients[1]) {
									i = 0;
									while (i < 3200) {
										client.publish('foo', 'bar');
										i++;
									}
									c = clients[1].split(' ');
									omem = c[13].split('=')[1];
									if (omem > 100000) {
										start_time = (start_time == 0) ? new Date().getTime() / 1000 : start_time;
										time_elapsed = new Date().getTime() / 1000 - start_time;
										if (time_elapsed >= 5)
											loop.break();
										else
											loop.next();
									} else {
										loop.next();
									}
								} else {
									loop.break();
								}
							});
						}, function () {
							if (omem >= 100000 && time_elapsed >= 5 && time_elapsed <= 10)
								ut.pass(test_case);
							else
								ut.fail('Client output buffer soft limit enforcing failed', true);
							testEmitter.emit('next');
						});
					}
				} catch (e) {
					ut.fail(e, true);
					testEmitter.emit('next');
				}
			});
		});
	}

	//UnStable
	tester.obuf_limits3 = function (errorCallback) {
		var test_case = 'Client output buffer soft limit is enforced if time is overreached';
		var i = 0,
		start_time = 0,
		time_elapsed = 0,
		omem = 0;
		client.config('set', 'client-output-buffer-limit', 'pubsub 0 100000 3', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			var newClient = redis.createClient(server_port, server_host);
			newClient.subscribe('foo', function (err, res) {
				if (err) {
					errorCallback(err);
				}
				try {
					if (!assert.ok(ut.match(res, 'subscribe foo 1'), test_case)) {
						/*
						 * send 50 publish command at once without waiting for reply
						 * get the client list properties
						 * and check for omem value
						 * This tweak is implemented since the async calls made by publish and client list commands,
						 * give enough time for redis to read and clear the output buffer and hence neither omem nor obl value
						 * increase. Instead of waiting for reply on publish and then publishing again after the reply
						 * 50(random number picked after trail and error method) publish commands are sent which are queued
						 * in buffer memory and thus causing increasing in OBL and omem properties
						 */
						g.asyncFor(0, -1, function (loop) {
							i = 0;
							while (i < 50) {
								client.publish('foo', 'bar');
								i++;
							}
							client.client('list', function (err, res) {
								if (err) {
									errorCallback(err);
								}
								clients = res.split('\n');
								if (clients[1]) {
									c = clients[1].split(' ');

									//omem value is cleared on reaching limit
									//if this happens then stop publishing and check for last omem value recorded
									if (omem < c[13].split('=')[1]) {
										omem = c[13].split('=')[1];
									} else
										loop.break();

									if (omem > 100000) {
										start_time = (start_time == 0) ? new Date().getTime() / 1000 : start_time;
										time_elapsed = new Date().getTime() / 1000 - start_time;
										if (time_elapsed >= 10)
											loop.break();
										else
											loop.next();
									} else
										loop.next();
								} else
									loop.break();
							});
						}, function () {
							if (omem >= 100000 && time_elapsed < 6)
								ut.pass(test_case);
							else
								ut.fail('Client output buffer soft limit is not enforced ', true);
							testEmitter.emit('next');
						});
					}
				} catch (e) {
					ut.fail(e, true);
					testEmitter.emit('next');
				}
			});
		});
	}
	
	return obuf_limits;
}

	())
