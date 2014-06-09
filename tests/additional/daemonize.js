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

exports.Deamon = (function () {
	//private properties
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	tp = new(require('../support/tmpfile.js'));
	deamon = {},
	name = 'Daemonize',
	tester = {},
	all_tests = {},
	server_pid = '',
	client_pid = '';

	//public property
	deamon.debug_mode = false;

	//public method
	deamon.start_test = function (cpid, callback) {
		testEmitter.on('start', function () {
			client_pid = cpid;
			all_tests = Object.keys(tester);
			testEmitter.emit('next');
		});
		testEmitter.on('next', function () {
			var test_case_name = all_tests.shift();
				if (test_case_name) {
					tester[test_case_name](function (error) {
						ut.fail(error);
						testEmitter.emit('next');
					});
				} else {
					testEmitter.emit('end');
				}
		});
		testEmitter.on('end', function () {
			callback(null, true);
		});

		if (deamon.debug_mode) {
			server.set_debug_mode(true);
		}

		testEmitter.emit('start');
	}

	//private methods
	function start_server(client_pid, option, callback) {
		var tags = 'daemonize';
		var overrides = {};
		overrides['daemonize'] = option;
		var args = {};
		args['name'] = name;
		args['tags'] = tags;
		args['overrides'] = overrides;
		(new Server()).start_server(client_pid, args, function (err, res) {
			if (err) {
				callback(err, null);
			}
			g.srv[client_pid][res]['client'].end();
			callback(null, res); // returned is server.pid
		});
	}
	function kill_server(client_pid, server_pid, callback) {
		server.kill_server(client_pid, server_pid, callback);
	}
	tester.Daemon1 = function (errorCallback) {
		var test_case = 'Windows does not support daemonize: Warning is seen.';
		var option = 'yes';
		start_server(client_pid, option, function (err, res) {
			if (err) {
				errorCallback(err, null);
			}
			server_pid = res;
			var pattern = 'Windows does not support daemonize. Start Redis as service';
			var retry = 10;
			g.asyncFor(0, retry, function (loop) {
				retry = loop.iteration();
				var file = g.srv[client_pid][server_pid]['stdout'];
				fs.readFile(file, function (err, result) {
					if (err) {
						errorCallback(err, null);
					}
					if (ut.match(pattern, result)) {
						loop.break();
					} else {
						loop.decrease(1);
						//retry-=1;
						setTimeout(function () {
							loop.next();
						}, 1000);
					}
				});
			}, function () {
				ut.assertEqual(retry, 0, test_case);
				kill_server(client_pid, server_pid, function (err, res) {
					if (err) {
						errorCallback(err, null);
					}
					testEmitter.emit('next');
				});
			});
		});
	}

	return deamon;

}
	());