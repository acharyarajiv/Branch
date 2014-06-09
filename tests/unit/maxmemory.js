// The copyright in this software is being made available under the BSD License, included below. This software may be subject to other third party and contributor rights, including patent rights, and no such rights are granted under this license.
//
// Copyright (c) 2013, Microsoft Open Technologies, Inc. 
//
// All rights reserved.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//     -             Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//     -             Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
//     -             Neither the name of the Microsoft Open Technologies, Inc. nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

exports.Maxmemory = (function () {
	//private properties
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	redis = require('redis'),
	maxmem = {},
	name = 'Maxmemory',
	client = '',
	tester = {},
	client_pid = '',
	server_pid = '',
	all_tests = {},
	server_host = '',
	server_port = '',
	policy = ['allkeys-random', 'allkeys-lru', 'volatile-lru', 'volatile-random', 'volatile-ttl'],
	policy1 = ['volatile-lru', 'volatile-random', 'volatile-ttl'];

	//public property
	maxmem.debug_mode = false;

	//public method
	maxmem.start_test = function (cpid, callback) {
		testEmitter.on('start', function () {
			var tags = 'maxmemory';
			var overrides = {};
			var args = {};
			args['name'] = name;
			args['tags'] = tags;
			args['overrides'] = overrides;
			server.start_server(cpid, args, function (err, res) {
				if (err) {
					callback(err, null);
				}
				client_pid = cpid;
				server_pid = res;
				server_port = g.srv[cpid][server_pid]['port'];
				server_host = g.srv[cpid][server_pid]['host'];
				// we already have a client while checking for the server, we dont need it now.
				g.srv[cpid][server_pid]['client'].end();
				if (maxmem.debug_mode) {
					log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[cpid][server_pid]['host'] + ':' + g.srv[cpid][server_pid]['port']);
				}
				all_tests = Object.keys(tester);
				testEmitter.emit('next');
			});
		});
		testEmitter.on('next', function () {
			setTimeout(function(){
				var test_case_name = all_tests.shift()
				if (test_case_name) {
					tester[test_case_name](function (error) {
						ut.fail(error);
						testEmitter.emit('next');
					});
				} else {
					client.end();
					if (maxmem.debug_mode) {
						log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
					}
					testEmitter.emit('end');
				}
			},ut.timeout);
		});
		testEmitter.on('end', function () {
			server.kill_server(client_pid, server_pid, function (err, res) {
				if (err) {
					callback(err, null);
				}
				callback(null, true);
			});
		});

		if (maxmem.debug_mode) {
			server.set_debug_mode(true);
		}

		testEmitter.emit('start');
	}

	//private methods

	tester.Max1 = function (errorCallback) {
		client = redis.createClient(server_port, server_host);
		g.asyncFor(0, policy.length, function (outerloop) {
			var i = outerloop.iteration();
			var test_case = 'maxmemory - is the memory limit honoured? - policy: ' + policy[i];
			//make sure to start with a blank instance
			client.flushall(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				//Get the current memory limit and calculate a new limit.We just add 100k to the current memory size so that it is fast for us to reach that limit.
				ut.serverInfo(client, 'used_memory', function (err, used) {
					if (err) {
						errorCallback(err);
					}
					var limit = parseInt(used) + (100 * 1024);
					client.config('set', 'maxmemory', limit, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						client.config('set', 'maxmemory-policy', policy[i], function (err, res) {
							if (err) {
								errorCallback(err);
							}
							//Now add keys until the limit is almost reached.
							var numkeys = 0;
							g.asyncFor(0, -1, function (innerloop) {
								client.setex(ut.randomKey(), 10000, 'x', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									++numkeys;
									ut.serverInfo(client, 'used_memory', function (err, used) {
										if ((parseInt(used) + 4096) > limit) {
											if (numkeys > 10)
												innerloop.break();
										}
										innerloop.next();
									});
								});
							}, function () {
								//If we add the same number of keys already added again, we should still be under the limit.
								g.asyncFor(0, numkeys, function (innerloop1) {
									client.setex(ut.randomKey(), 10000, 'x', function (err, res) {
										if (err) {
											errorCallback(err);
										}
										innerloop1.next();
									});
								}, function () {

									ut.serverInfo(client, 'used_memory', function (err, used) {
										if (err) {
											errorCallback(err);
										}
										ut.assertOk(check(parseInt(used), (limit + 4096)),null, test_case);
										outerloop.next();

										function check(a, b) {
											if (a < b)
												return true;
											else
												return false;
										}
									});
								});
							});
						});
					});
				});
			});
		}, function () {
			client.end();
			if (maxmem.debug_mode) {
				log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
			}
			testEmitter.emit('next');
		});
	};

	tester.Max2 = function (errorCallback) {
		client = redis.createClient(server_port, server_host);
		g.asyncFor(0, policy.length, function (outerloop) {
			var i = outerloop.iteration();
			var test_case = 'maxmemory - only allkeys-* should remove non-volatile keys ' + policy[i];
			//make sure to start with a blank instance
			client.flushall(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				//Get the current memory limit and calculate a new limit.We just add 100k to the current memory size so that it is fast for us to reach that limit.
				ut.serverInfo(client, 'used_memory', function (err, used) {
					if (err) {
						errorCallback(err);
					}
					var limit = parseInt(used) + (100 * 1024);
					client.config('set', 'maxmemory', limit, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						client.config('set', 'maxmemory-policy', policy[i], function (err, res) {
							if (err) {
								errorCallback(err);
							}
							//Now add keys until the limit is almost reached.
							var numkeys = 0;
							g.asyncFor(0, -1, function (innerloop) {
								client.set(ut.randomKey(), 'x', function (err, res) {
									if (err) {
										errorCallback(err);
									}
									++numkeys;
									ut.serverInfo(client, 'used_memory', function (err, used) {
										if ((parseInt(used) + 4096) > limit) {
											if (numkeys > 10)
												innerloop.break();
										}
										innerloop.next();
									});
								});
							}, function () {
								//If we add the same number of keys already added again and the policy is allkeys-* we should still be under the limit.Otherwise we should see an error reported by Redis.
								var error = 0;
								g.asyncFor(0, numkeys, function (innerloop1) {
									client.set(ut.randomKey(), 'x', function (err, res) {
										if (err) {
											if (ut.match('used memory', err)) {
												error = 1;
											}
										}
										innerloop1.next();
									});
								}, function () {
									if (ut.match('allkeys-', policy[i])) {
										ut.serverInfo(client, 'used_memory', function (err, used) {
											if (err) {
												errorCallback(err);
											}
											ut.assertOk(check(parseInt(used), (limit + 4096)),null, test_case);
										});
									} else {
										ut.assertEqual(error, 1, test_case);
									}
									outerloop.next();

									function check(a, b) {
										if (a < b)
											return true;
										else
											return false;
									}
								});
							});
						});
					});
				});
			});
		}, function () {
			client.end();
			if (maxmem.debug_mode) {
				log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
			}
			testEmitter.emit('next');
		});
	};

	tester.Max3 = function (errorCallback) {
		client = redis.createClient(server_port, server_host);
		g.asyncFor(0, policy1.length, function (outerloop) {
			var i = outerloop.iteration();
			var test_case = 'policy ' + policy1[i] + ' should only remove volatile keys';
			//make sure to start with a blank instance
			client.flushall(function (err, res) {
				if (err) {
					errorCallback(err);
				}
				//Get the current memory limit and calculate a new limit.We just add 100k to the current memory size so that it is fast for us to reach that limit.
				ut.serverInfo(client, 'used_memory', function (err, used) {
					if (err) {
						errorCallback(err);
					}
					var limit = parseInt(used) + (100 * 1024);
					client.config('set', 'maxmemory', limit, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						client.config('set', 'maxmemory-policy', policy1[i], function (err, res) {
							if (err) {
								errorCallback(err);
							}
							//Now add keys until the limit is almost reached.
							var numkeys = 0;
							g.asyncFor(0, -1, function (innerloop) {
								// Odd keys are volatile
								// Even keys are non volatile.
								var key = 'key:' + numkeys;
								if (numkeys % 2 == 0) {
									client.setex(key, 10000, 'x', function (err, res) {
										if (err) {
											errorCallback(err);
										}
									});
								} else {
									client.set(key, 'x', function (err, res) {
										if (err) {
											errorCallback(err);
										}
									});
								}
								ut.serverInfo(client, 'used_memory', function (err, used) {
									if ((parseInt(used) + 4096) > limit) {
										if (numkeys > 10)
											innerloop.break();
									}
									++numkeys;
									innerloop.next();
								});
							}, function () {
								//Now we add the same number of volatile keys already added. We expect Redis to evict only volatile keys in order to make space.
								var under_limit = false;
								var key_exists = false;
								var loop1 = numkeys;
								g.asyncFor(0, loop1, function (innerloop2) {
									var key = 'foo' + innerloop2.iteration();
									client.setex(key, 10000, 'x', function (err, res) {
										if (err) {
											errorCallback(err);
										}
										innerloop2.next();
									});
								}, function () {
									ut.serverInfo(client, 'used_memory', function (err, used) {
										if (parseInt(used) < (limit + 4096))
											under_limit = true;
										else
											under_limit = false;
									});
									var loop2 = numkeys;
									g.asyncFor(0, loop2, function (innerloop1) {
										var key = 'key:' + innerloop1.iteration();
										client.exists(key, function (err, res) {
											if (err) {
												errorCallback(err);
											}
											key_exists = true;
											innerloop1.next();
										});
									}, function () {
										ut.assertMany(
											[
												['ok',under_limit,null],
												['ok',key_exists,null]
											],test_case);
										outerloop.next();
									});

								});
							});
						});
					});
				});
			});
		}, function () {
			client.end();
			if (maxmem.debug_mode) {
				log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
			}
			testEmitter.emit('next');
		});
	};

	return maxmem;

}
	());