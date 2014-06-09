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

exports.List2 = (function () {
	//private properties
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	list_common = require('./list-common.js'),
	list2 = {},
	name = 'List2',
	client = '',
	tester = {},
	server_pid = '',
	all_tests = {};

	//public property
	list2.debug_mode = false;

	//public method
	list2.start_test = function (client_pid, callback) {
		testEmitter.on('start', function () {
			var tags = 'list';
			var overrides = {};
			overrides['list-max-ziplist-entries'] = 256;
			overrides['list-max-ziplist-value'] = 16;
			var args = {};
			args['name'] = name;
			args['tags'] = tags;
			args['overrides'] = overrides;
			server.start_server(client_pid, args, function (err, res) {
				if (err) {
					callback(err, null);
				}
				server_pid = res;
				client = g.srv[client_pid][server_pid]['client'];
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
					if (list2.debug_mode) {
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

		if (list2.debug_mode) {
			server.set_debug_mode(true);
		}

		testEmitter.emit('start');
	}

	//test methods
	tester.List2_1 = function (errorCallback) {
		var test_case = 'LTRIM stress testing - ziplist';
		var large = list_common.ziplist;
		var mylist = [];
		var pass_count = 0;
		var startlen = 32;

		client.del('mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.rpush('mylist', large, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				mylist.push(large);
				g.asyncFor(0, startlen, function (loop) {
					var str = g.randomInt(9223372036854775807);
					client.rpush('mylist', str, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						mylist.push(str);
						loop.next();
					});
				},
					function () {
					g.asyncFor(0, 1000, function (outerloop) {
						var min = Math.floor(Math.random() * startlen);
						var max = min + (Math.floor(Math.random() * startlen));
						mylist = mylist.slice(min, max + 1);
						client.ltrim('mylist', min, max, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							client.lrange('mylist', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								try {
									if (!assert.deepEqual(res, mylist, test_case)) {
										pass_count += 1; ;
									}
								} catch (e) {
									ut.log_error(e);
								}
								client.llen('mylist', function (err, length) {
									if (err) {
										errorCallback(err);
									}
									g.asyncFor(length, startlen + 1, function (innerloop) {
										var str = g.randomInt(9223372036854775807);
										client.rpush('mylist', str, function (err, res) {
											if (err) {
												errorCallback(err);
											}
											mylist.push(str);
											innerloop.next();
										});
									}, function () {
										outerloop.next();
									});
								});
							});
						});
					}, function () {
						if (pass_count == 1000) {
							ut.pass(test_case);
						} else {
							ut.fail(test_case);
						}
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	tester.List2_2 = function (errorCallback) {
		var test_case = 'LTRIM stress testing - linkedlist';
		var large = list_common.linkedlist;
		var mylist = [];
		var pass_count = 0;
		var startlen = 32;

		client.del('mylist', function (err, res) {
			if (err) {
				errorCallback(err);
			}
			client.rpush('mylist', large, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				mylist.push(large);
				g.asyncFor(0, startlen, function (loop) {
					var str = g.randomInt(9223372036854775807);
					client.rpush('mylist', str, function (err, res) {
						if (err) {
							errorCallback(err);
						}
						mylist.push(str);
						loop.next();
					});
				},
					function () {
					g.asyncFor(0, 1000, function (outerloop) {
						var min = Math.floor(Math.random() * startlen);
						var max = min + (Math.floor(Math.random() * startlen));
						mylist = mylist.slice(min, max + 1);
						client.ltrim('mylist', min, max, function (err, res) {
							if (err) {
								errorCallback(err);
							}
							client.lrange('mylist', 0, -1, function (err, res) {
								if (err) {
									errorCallback(err);
								}
								try {
									if (!assert.deepEqual(res, mylist, test_case)) {
										pass_count += 1;
									}
								} catch (e) {
									ut.log_error(e);
								}
								client.llen('mylist', function (err, length) {
									if (err) {
										errorCallback(err);
									}
									g.asyncFor(length, startlen + 1, function (innerloop) {
										var str = g.randomInt(9223372036854775807);
										client.rpush('mylist', str, function (err, res) {
											if (err) {
												errorCallback(err);
											}
											mylist.push(str);
											innerloop.next();
										});
									}, function () {
										outerloop.next();
									});
								});
							});
						});
					}, function () {
						if (pass_count == 1000) {
							ut.pass(test_case);
						} else {
							ut.fail(test_case);
						}
						testEmitter.emit('next');
					});
				});
			});
		});
	};

	return list2;

}
	());