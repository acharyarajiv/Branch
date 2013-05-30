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

exports.convert_zipmap = (function () {
	var testEmitter = new events.EventEmitter(),
	ut = new Utility(),
	server = new Server(),
	server1 = new Server(),
	server2 = new Server(),
	convert_zipmap = {},
	name = 'convert-zipmap-hash-on-load',
	client = '',
	tester = {},
	server_pid = '',
	all_tests = '',
	server_port = '',
	server_host = '',
	client_pid = '',
	server_path = './tests/tmp/server_convert-zipmap-hash-on-load';

	convert_zipmap.debug_mode = false;

	function dirExistsSync(d) {
		try {
			fs.statSync(d);
			return true
		} catch (er) {
			return false
		}
	}

	convert_zipmap.start_test = function (cpid, callback) {
		testEmitter.on('start', function () {
			//check if directory exists if not then create a new directory
			if (!dirExistsSync('./tests/tmp'))
				fs.mkdirSync('./tests/tmp');

			if (!dirExistsSync('./tests/tmp/server_convert-zipmap-hash-on-load'))
				fs.mkdirSync('./tests/tmp/server_convert-zipmap-hash-on-load');

			//copy encodings.rdb and paste it in tests/tmp folder
			fs.createReadStream('tests/assets/hash-zipmap.rdb').pipe(fs.createWriteStream(server_path + '/hash-zipmap.rdb'));

			all_tests = Object.keys(tester);
			testEmitter.emit('next');
		});
		testEmitter.on('end', function () {
			callback(null, true);
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
		if (convert_zipmap.debug_mode) {
			server.set_debug_mode(true);
		}
		testEmitter.emit('start');
	}

	tester.convert_zipmap1 = function (errorCallback) {

		var test_case = 'RDB load zipmap hash: converts to ziplist';
		var tags = 'convert_zipmap',
		overrides = {},
		args = {};
		args['name'] = name;
		args['tags'] = tags;
		overrides['dir'] = server_path;
		overrides['dbfilename'] = 'hash-zipmap.rdb';
		args['overrides'] = overrides;
		server.start_server(client_pid, args, function (err, res) {
			if (err) {
				errorCallback(err, null);
			}
			server_pid = res;
			client = g.srv[client_pid][server_pid]['client'];
			server_host = g.srv[client_pid][server_pid]['host'];
			server_port = g.srv[client_pid][server_pid]['port'];
			client.select(0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.debug('object', 'hash', function (err, resHash) {
					if (err) {
						errorCallback(err);
					}
					client.hlen('hash', function (err, resLen) {
						if (err) {
							errorCallback(err);
						}
						client.hmget('hash', 'f1', 'f2', function (err, resGet) {
							if (err) {
								errorCallback(err);
							}
							ut.assertMany(
								[
									['ok','ziplist', resHash],
									['equal',resLen, 2],
									['deepequal',resGet, ['v1', 'v2']]
								],test_case);
							client.end();
							server.kill_server(client_pid, server_pid, function (err, res) {
								if (err) {
									errorCallback(err, null);
								}
								testEmitter.emit('next');
							});
						});
					});
				});
			});
		});
	};

	tester.convert_zipmap2 = function (errorCallback) {
		var test_case = 'RDB load zipmap hash: converts to hash table when hash-max-ziplist-entries is exceeded';
		var tags = 'convert_zipmap',
		overrides = {},
		args = {};
		args['name'] = name;
		args['tags'] = tags;
		overrides['dir'] = server_path;
		overrides['dbfilename'] = 'hash-zipmap.rdb';
		overrides['hash-max-ziplist-entries'] = 1;
		args['overrides'] = overrides;
		server1.start_server(client_pid, args, function (err, res) {
			if (err) {
				errorCallback(err, null);
			}
			server_pid1 = res;
			client = g.srv[client_pid][server_pid1]['client'];
			server_host = g.srv[client_pid][server_pid1]['host'];
			server_port = g.srv[client_pid][server_pid1]['port'];
			client.select(0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.debug('object', 'hash', function (err, resHash) {
					if (err) {
						errorCallback(err);
					}
					client.hlen('hash', function (err, resLen) {
						if (err) {
							errorCallback(err);
						}
						client.hmget('hash', 'f1', 'f2', function (err, resGet) {
							if (err) {
								errorCallback(err);
							}
							ut.assertMany(
								[
									['ok','hashtable', resHash],
									['equal',resLen, 2],
									['deepequal',resGet, ['v1', 'v2']]
								],test_case);
							client.end();
							server1.kill_server(client_pid, server_pid1, function (err, res) {
								if (err) {
									errorCallback(err, null);
								}
								testEmitter.emit('next');
							});
						});
					});
				});
			});
		});
	};

	tester.convert_zipmap3 = function (errorCallback) {
		var test_case = 'RDB load zipmap hash: converts to hash table when hash-max-ziplist-value is exceeded';
		var tags = 'convert_zipmap',
		overrides = {},
		args = {};
		args['name'] = name;
		args['tags'] = tags;
		overrides['dir'] = server_path;
		overrides['dbfilename'] = 'hash-zipmap.rdb';
		overrides['hash-max-ziplist-value'] = 1;
		args['overrides'] = overrides;
		server2.start_server(client_pid, args, function (err, res) {
			if (err) {
				errorCallback(err, null);
			}
			server_pid2 = res;
			client = g.srv[client_pid][server_pid2]['client'];
			server_host = g.srv[client_pid][server_pid2]['host'];
			server_port = g.srv[client_pid][server_pid2]['port'];
			client.select(0, function (err, res) {
				if (err) {
					errorCallback(err);
				}
				client.debug('object', 'hash', function (err, resHash) {
					if (err) {
						errorCallback(err);
					}
					client.hlen('hash', function (err, resLen) {
						if (err) {
							errorCallback(err);
						}
						client.hmget('hash', 'f1', 'f2', function (err, resGet) {
							if (err) {
								errorCallback(err);
							}
							ut.assertMany(
								[
									['ok','hashtable', resHash],
									['equal',resLen, 2],
									['deepequal',resGet, ['v1', 'v2']]
								],test_case);
							client.end();
							server2.kill_server(client_pid, server_pid2, function (err, res) {
								if (err) {
									errorCallback(err, null);
								}
								testEmitter.emit('next');
							});
						});
					});
				});
			});
		});
	};

	return convert_zipmap;
}

	())
