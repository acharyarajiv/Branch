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

exports.Quit = (function () {
	//private properties
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	quit = {},
	name = 'Quit',
	client = '',
	tester = {},
	server_pid = '',
	client_pid = '',
	all_tests = {};

	//public property
	quit.debug_mode = false;

	//public method
	quit.start_test = function (cpid, callback) {
		testEmitter.on('start', function () {
			var tags = 'quit';
			var overrides = {};
			var args = {};
			args['name'] = name;
			args['tags'] = tags;
			args['overrides'] = overrides;
			client_pid = cpid;
			server.start_server(cpid, args, function (err, res) {
				if (err) {
					callback(err, null);
				}
				server_pid = res;
				server_port = g.srv[cpid][server_pid]['port'];
				server_host = g.srv[cpid][server_pid]['host'];
				// we already have a client while checking for the server, we dont need it now.
				g.srv[cpid][server_pid]['client'].end();
				if (quit.debug_mode) {
					log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[cpid][server_pid]['host'] + ':' + g.srv[cpid][server_pid]['port']);
				}
				all_tests = Object.keys(tester);
				testEmitter.emit('next');
			});
		});
		testEmitter.on('next', function () {
			setTimeout(function(){
				var test_case_name = all_tests.shift();
				if (test_case_name) {
					tester[test_case_name](function (error) {
						ut.fail(error);
						testEmitter.emit('next');
					});
				} else {
					testEmitter.emit('end');
				}
			},ut.timeout);
		});
		testEmitter.on('end', function () {
			server.kill_server(client_pid, server_pid, function (err, res) {
				if (err) {
					callback(err, null);
				} else if (res) {
					callback(null, true);
				}
			});
		});

		if (quit.debug_mode) {
			server.set_debug_mode(true);
		}

		testEmitter.emit('start');
	}

	//private methods
	tester.quit1 = function (errorCallback) {
		var test_case = 'QUIT returns OK';
		ut.reconnect(redis, client_pid, server_pid, function (err, client) {
			if (err) {
				errorCallback(err);
			}
			if (quit.debug_mode) {
				log.notice(name + ':Client connected  and listening on socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
			}
			client.quit(function (err, result) {
				if (err) {
					errorCallback(err);
				}
				client.ping(function (err, res) {
					if (res) {
						errorCallback(res);
					}
					ut.assertMany(
						[
							['ok',err, null],
							['equal',result, 'OK']
						],test_case);
					if (quit.debug_mode) {
						log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
					}
					testEmitter.emit('next');
				});
			});
		});
	};

	tester.quit2 = function (errorCallback) {
		var test_case = 'Pipelined commands after QUIT must not be executed';
		ut.reconnect(redis, client_pid, server_pid, function (err, client) {
			if (err) {
				errorCallback(err);
			}
			if (quit.debug_mode) {
				log.notice(name + ':Client connected  and listening on socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
			}
			client.quit(function (err, result) {
				if (err) {
					errorCallback(err);
				}
				if (quit.debug_mode) {
					log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
				}
				client.set('foo', 'bar', function (error, res2) {
					if (err) {
						errorCallback(err);
					}
					ut.reconnect(redis, client_pid, server_pid, function (err, client) {
						if (err) {
							errorCallback(err);
						}
						if (quit.debug_mode) {
							log.notice(name + ':Client connected  and listening on socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
						}
						client.get('foo', function (err, res) {
							if (err) {
								errorCallback(res);
							}
							ut.assertMany(
								[
									['equal',res, null],
									['ok',error, null],
									['equal',result, 'OK']
								],test_case);
							client.end();
							if (quit.debug_mode) {
								log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
							}
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};
	
	tester.quit3 = function (errorCallback) {
		var test_case = 'Pipelined commands after QUIT that exceed read buffer size';
		ut.reconnect(redis, client_pid, server_pid, function (err, client) {
			if (err) {
				errorCallback(err);
			}
			if (quit.debug_mode) {
				log.notice(name + ':Client connected  and listening on socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
			}
			client.quit(function (err, result) {
				if (err) {
					errorCallback(err);
				}
				if (quit.debug_mode) {
					log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
				}
				client.set('foo', g.fillString(1000, 'x'), function (error, res2) {
					if (err) {
						errorCallback(err);
					}
					ut.reconnect(redis, client_pid, server_pid, function (err, client) {
						if (err) {
							errorCallback(err);
						}
						if (quit.debug_mode) {
							log.notice(name + ':Client connected  and listening on socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
						}
						client.get('foo', function (err, res) {
							if (err) {
								errorCallback(res);
							}
							ut.assertMany(
								[
									['equal',res, null],
									['ok',error, null],
									['equal',result, 'OK']
								],test_case);
							client.end();
							if (quit.debug_mode) {
								log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
							}
							testEmitter.emit('next');
						});
					});
				});
			});
		});
	};

	return quit;

}
	());