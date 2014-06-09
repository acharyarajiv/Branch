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

exports.redis_cli = (function () {
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	redis_cli = {},
	name = 'redis_cli',
	client = '',
	cmdCli = '',
	tester = {},
	server_pid = '',
	all_tests = '',
	server_port = '',
	server_host = '',
	client_pid = '';

	redis_cli.debug_mode = false;

	function dirExistsSync(d) {
		try {
			fs.statSync(d);
			return true
		} catch (er) {
			return false
		}
	}

	//can be used once for a process/process_child
	function write_cli(cli_console, msg) {
		cli_console.stdin.write(msg);
		cli_console.stdin.end();
	}

	function run_command(cli_console, msg) {
		write_cli(cli_console, msg)
	}

	redis_cli.start_test = function (cpid, callback) {
		testEmitter.on('start', function () {
			var tags = 'cli',
			overrides = {},
			args = {};
			args['name'] = name;
			args['tags'] = tags;
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
				cmdCli = '.' + sep + 'redis' + sep + 'src' + sep + REDIS_CLI + ' -p ' + server_port;
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
					if (redis_cli.debug_mode) {
						log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
					}
					testEmitter.emit('end');
				}
		});
		if (redis_cli.debug_mode) {
			server.set_debug_mode(true);
		}
		testEmitter.emit('start');
	}

	tester.cli1 = function (errorCallback) {
		var test_case = 'test_interactive_cli: INFO response should be printed raw';
		var cli_console = child.exec(cmdCli);
		cli_console.stdout.on('data', function (data) {
			var patt = new RegExp(/[a-z0-9_]+:[a-z0-9_]+/);
			var result = patt.test(data);
			ut.assertOk(result, null, test_case);
			testEmitter.emit('next');
		});
		setTimeout(function () {
			run_command(cli_console, 'info');
		}, 500);
	};

	tester.cli2 = function (errorCallback) {
		var test_case = 'test_interactive_cli: Status reply';
		var cli_console = child.exec(cmdCli);
		cli_console.stdout.on('data', function (data) {
			ut.assertEqual(data.trim(), 'OK', test_case);
			testEmitter.emit('next');
		});
		setTimeout(function () {
			run_command(cli_console, 'set key foo');
		}, 500);
	};

	tester.cli3 = function (errorCallback) {
		var test_case = 'test_interactive_cli: Integer reply';
		var cli_console = child.exec(cmdCli);
		cli_console.stdout.on('data', function (data) {
			ut.assertEqual(data.trim(), '1', test_case);
			testEmitter.emit('next');
		});
		setTimeout(function () {
			run_command(cli_console, 'incr counter');
		}, 500);
	};

	tester.cli4 = function (errorCallback) {
		var test_case = 'test_interactive_cli: Bulk reply';
		var cli_console = child.exec(cmdCli);
		cli_console.stdout.on('data', function (data) {
			ut.assertEqual(data.trim(), 'foo', test_case);
			testEmitter.emit('next');
		});
		setTimeout(function () {
			client.set('key', 'foo');
			run_command(cli_console, 'get key');
		}, 500);
	};

	tester.cli5 = function (errorCallback) {
		var test_case = 'test_interactive_cli: Multi-bulk reply';
		var cli_console = child.exec(cmdCli);
		cli_console.stdout.on('data', function (data) {
			ut.assertEqual(data.trim(), 'foo\nbar', test_case);
			testEmitter.emit('next');
		});
		setTimeout(function () {
			client.rpush('list', 'foo');
			client.rpush('list', 'bar');
			run_command(cli_console, 'lrange list 0 -1');
		}, 500);
	};

	tester.cli6 = function (errorCallback) {
		var test_case = 'test_interactive_cli: Parsing quotes';
		var strError = '';
		async.series({
			one : function (cb) {
				var cli_console = child.exec(cmdCli);
				cli_console.stdout.on('data', function (data) {
					try {
						//trim the data cause of new line charecter
						if (!assert.equal(data.trim(), 'OK', test_case)) {
							client.get('key', function (err, res) {
								try {
									if (!assert.equal(res, 'bar', test_case))
										cb(null, true);
								} catch (e) {
									strError = e;
									cb(null, true);
								}
							});
						}
					} catch (e) {
						strError = e;
						cb(null, true);
					}
				});
				setTimeout(function () {
					run_command(cli_console, "set key \"bar\"");
				}, 500);
			},
			two : function (cb) {
				var cli_console = child.exec(cmdCli);
				cli_console.stdout.on('data', function (data) {
					try {
						//trim the data cause of new line charecter
						if (!assert.equal(data.trim(), 'OK', test_case)) {
							client.get('key', function (err, res) {
								try {
									if (!assert.equal(res, ' bar ', test_case))
										cb(null, true);
								} catch (e) {
									strError = e;
									cb(null, true);
								}
							});
						}
					} catch (e) {
						strError = e;
						cb(null, true);
					}
				});
				setTimeout(function () {
					run_command(cli_console, "set key \" bar \"");
				}, 500);
			},
			three : function (cb) {
				var cli_console = child.exec(cmdCli);
				cli_console.stdout.on('data', function (data) {
					try {
						//trim the data cause of new line charecter
						if (!assert.equal(data.trim(), 'OK', test_case)) {
							client.get('key', function (err, res) {
								try {
									if (!assert.equal(res, '"bar"', test_case))
										cb(null, true);
								} catch (e) {
									strError = e;
									cb(null, true);
								}
							});
						}
					} catch (e) {
						strError = e;
						cb(null, true);
					}
				});
				setTimeout(function () {
					run_command(cli_console, "set key \"\\\"bar\\\"\"");
				}, 500);
			},
			four : function (cb) {
				var cli_console = child.exec(cmdCli);
				cli_console.stdout.on('data', function (data) {
					try {
						//trim the data cause of new line charecter
						if (!assert.equal(data.trim(), 'OK', test_case)) {
							client.get('key', function (err, res) {
								try {
									if (!assert.equal(res, '\tbar\t', test_case))
										cb(null, true);
								} catch (e) {
									strError = e;
									cb(null, true);
								}
							});
						}
					} catch (e) {
						strError = e;
						cb(null, true);
					}
				});
				setTimeout(function () {
					run_command(cli_console, "set key \"\tbar\t\"");
				}, 500);
			},
			five : function (cb) {
				var cli_console = child.exec(cmdCli);
				cli_console.stdout.on('data', function (data) {
					try {
						//trim the data cause of new line charecter
						if (!assert.equal(data.trim(), 'ERR wrong number of arguments for \'get\' command', test_case)){
							cb(null, true);
						}
					} catch (e) {
						strError = e;
						cb(null, true);
					}
				});
				
				setTimeout(function () {
					run_command(cli_console, "get key '\'");
				}, 500);
			},
			six : function (cb) {
				var cli_console = child.exec(cmdCli);
				cli_console.stdout.on('data', function (data) {
					try {
						//trim the data cause of new line charecter
						if (!assert.equal(data.trim(), 'ERR wrong number of arguments for \'get\' command', test_case))
							cb(null, true);
					} catch (e) {
						strError = e;
						cb(null, true);
					}
				});
				setTimeout(function () {
					run_command(cli_console, "get key x");
				}, 500);
			},
			seven : function (cb) {
				var cli_console = child.exec(cmdCli);
				cli_console.stdout.on('data', function (data) {
					try {
						//trim the data cause of new line charecter
						if (!assert.equal(data.trim(), 'OK', test_case)) {
							client.get('key', function (err, res) {
								try {
									if (!assert.equal(res, 'bar', test_case))
										cb(null, true);
								} catch (e) {
									strError = e;
									cb(null, true);
								}
							});
						}
					} catch (e) {
						strError = e;
						cb(null, true);
					}
				});
				setTimeout(function () {
					run_command(cli_console, "set key\"\" bar");
				}, 500);
			}
		}, function (err, results) {
			ut.assertEqual(strError, '', test_case);
			testEmitter.emit('next');
		});
	};

	tester.cli7 = function (errorCallback) {
		var test_case = 'test_tty_cli: Status reply';
		var cli_console = child.exec(cmdCli + ' -n 0 set key bar');
		cli_console.stdout.on('data', function (data) {
			try {
				//trim the data cause of new line charecter
				if (!assert.equal(data.trim(), 'OK', test_case)) {
					client.get('key', function (err, res) {
						ut.assertEqual(res, 'bar', test_case);
						testEmitter.emit('next');
					});
				}
			} catch (e) {
				ut.fail(e, true);
				testEmitter.emit('next');
			}
		});
	};

	tester.cli8 = function (errorCallback) {
		var test_case = 'test_tty_cli: Integer reply';
		client.del('counter');
		var cli_console = child.exec(cmdCli + ' -n 0 incr counter');
		cli_console.stdout.on('data', function (data) {
			ut.assertEqual(data.trim(), '1', test_case);
			testEmitter.emit('next');
		});
	};

	tester.cli9 = function (errorCallback) {
		var test_case = 'test_tty_cli: Bulk reply';
		client.set('key', 'tab\tnewline\n');
		var cli_console = child.exec(cmdCli + ' -n 0 get key');
		cli_console.stdout.on('data', function (data) {
			ut.assertEqual(data.trim(), 'tab\tnewline', test_case);
			testEmitter.emit('next');
		});
	};

	tester.cli10 = function (errorCallback) {
		var test_case = 'test_tty_cli: Multi-bulk reply';
		client.del('list');
		client.rpush('list', 'foo');
		client.rpush('list', 'bar');
		var cli_console = child.exec(cmdCli + ' -n 0 lrange list 0 -1');
		cli_console.stdout.on('data', function (data) {
			ut.assertEqual(data.trim(), 'foo\nbar', test_case);
			testEmitter.emit('next');
		});
	};

	tester.cli11 = function (errorCallback) {
		var test_case = 'test_tty_cli: Read last argument from pipe';
		var cli_console = child.exec('echo foo');
		cli_console.stdout.on('data', function (data) {
			//trim the data cause of new line charecter
			var cli_console1 = child.exec(cmdCli + ' -n 0 set key ' + data);
			setTimeout(function () {
				client.get('key', function (err, res) {
					ut.assertEqual(res, 'foo', test_case);
					testEmitter.emit('next');
				});
			}, 1000);

		});
	};

	tester.cli12 = function (errorCallback) {
		var test_case = 'test_tty_cli: Read last argument from file';
		
		if(process.platform === 'win32'){
			ut.pass(test_case);
			testEmitter.emit('next');
		}
		else{
			//check if directory exists if not then create a new directory
			if (!dirExistsSync('./tests/tmp'))
				fs.mkdirSync('./tests/tmp');
			fs.writeFile('./tests/tmp/cli1.txt', 'from file', function (err) {
				if (err) {
					console.log(err);
				}
				var cli_console = child.exec('tail < tests/tmp/cli1.txt');
				cli_console.stdout.on('data', function (data) {
					var cli_console1 = child.exec(cmdCli + ' -n 0 set key ' + data.trim());
					client.get('key', function (err, res) {
						ut.assertEqual(res, 'foo', test_case);
						testEmitter.emit('next');
					});
				});

			});
		}

	};

	return redis_cli;
}

	())
