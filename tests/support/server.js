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

// gloabal
var debug_mode = false

function Server() {

	this.list_directives = new Array();
	this.tp = new(require('./tmpfile.js'));
	this.config = {};
	this.overrides = {};
	this.tags = {};
	this.name = {};
	this.stdout_file = '',
	this.stderr_file = '';
	this.stdout_stream = '';
	this.stderr_stream = '';
	this.config_file = '';
	this.server = '';
	this.client = '';
	this.host = '';
	this.port = '';
	//this.debug_mode = false;

}
Server.prototype.set_debug_mode = function (mode) {
	var that = this;
	debug_mode = mode;
};

Server.prototype.start_server = function (cpid, options, s_callback) {
	var that = this;
	//setup defaults
	try {
		that.baseconfig = 'default.conf';
		//parse options
		for (opt in options) {
			switch (opt) {
			case 'config':
				that.baseconfig = options[opt];
				break;
			case 'overrides':
				that.overrides = options[opt];
				break;
			case 'tags':
				that.tags = options[opt];
				break;
			case 'name':
				that.name = options[opt];
				break;
			default:
				console.log('Unkowen option:' + opt);
				process.exit(1);
				break;
			}
		}
		var fileContent = {};
		var fn = '.' + sep + 'tests' + sep + 'assets' + sep + that.baseconfig;
		if (fs.existsSync(fn)) {
			fileContent = fs.readFileSync(fn).toString();
			var data = fileContent.split('\n');
			for (line in data) {
				if (data[line].length > 0 && data[line].charAt(0) != '#') {
					if (data[line].trim() != '') {
						var temp = '';
						var elements = data[line].split(' ');
						var directive = elements[0];
						var arguments = elements.slice(1);
						if (that.list_directives.indexOf(directive) == -1) {
							that.list_directives.push(directive);
							that.config[directive] = '';
							for (var i = 0; i < arguments.length; i++)
								that.config[directive] += ' ' + arguments[i];
						} else {
							temp = directive + '' + that.config[directive];
							if (typeof that.config[directive] === 'string') {
								var arr = new Array();
								arr.push(temp);
								temp = directive;
								for (var i = 0; i < arguments.length; i++)
									temp += ' ' + arguments[i];
								arr.push(temp);
								that.config[directive] = arr;
							} else {
								var obj = that.config[directive];
								temp = directive;
								for (var i = 0; i < arguments.length; i++)
									temp += ' ' + arguments[i];
								obj.push(temp);
								that.config[directive] = obj;
							}
						}
					}
				}
			}
		} else {
			console.log('Not reading file ..');
			process.exit(1);
		}

		if (Object.keys(that.overrides).length > 0) {
			for (key in that.overrides) {
				that.config[key] = that.overrides[key];
			}
		}

		// start every server on a different port
		g.availablePorts(cpid, function (err, port) {
			if (err) {
				s_callback(err, null);
			}
			that.config['port'] = that.port = port;
			that.config['bind'] = that.host = g.host;

			// use a different directory every time a server is started
			if (that.config['dir'] === 'undefinied' || (that.config['dir']).trim() === './') {
				that.config['dir'] = that.tp.tmpdir('server');
			}

			async.series({
				one : function (cb) {
					// find the number of entries to be written;
					var count = 0,
					total = 0;
					for (d in that.config)
						count++;
					//write new configuration to temporary file
					if(that.tags === 'sentinel')
						that.config_file = that.tp.tmpfile(that.config['dir'], 'sentinel') + '.conf';
					else
						that.config_file = that.tp.tmpfile(that.config['dir'], 'redis') + '.conf';
					var stream = fs.createWriteStream(that.config_file);
					stream.once('open', function (fd) {
						for (directive in that.config) {
							total++;
							if (typeof that.config[directive] === 'object') {
								for (var i = 0; i < that.config[directive].length; i++)
									stream.write(that.config[directive][i] + '\n');
							} else {
								if (that.config.hasOwnProperty(directive)) {
									stream.write(directive + ' ' + that.config[directive] + '\n');
								}
							}
							if (count === total) {
								stream.end();
								stream.destroySoon();
							}
						}
					});
					stream.on('close', function () {
						cb(null, true);
					});
				},
				two : function (cb) {

					that.stdout_file = that.tp.tmpfile(that.config['dir'], 'stdout') + '.file';
					that.stderr_file = that.tp.tmpfile(that.config['dir'], 'stderr') + '.file';
					that.stdout_stream = fs.createWriteStream(that.stdout_file);
					that.stderr_stream = fs.createWriteStream(that.stderr_file);

					that.stdout_stream.once('open', function (fd) {
						if(that.tags === 'sentinel')
							that.server = child.spawn('.' + sep + 'redis' + sep + 'src' + sep + REDIS_SERVER, [that.config_file,'--sentinel']);
						else
							that.server = child.spawn('.' + sep + 'redis' + sep + 'src' + sep + REDIS_SERVER, [that.config_file]);
						that.server.stdout.pipe(that.stdout_stream, {
							end : false
						});
						that.server.stderr.pipe(that.stderr_stream, {
							end : false
						});
						if (!g.srv.hasOwnProperty(cpid)) {
							g.srv[cpid] = {};
						}
						g.srv[cpid][that.server.pid] = {};
						if (debug_mode) {
							log.notice(that.name + ':Redis Server started on socket: ' + that.host + ':' + that.port);
							log.notice(that.name + ':Stdout file at: ' + that.stdout_file);
							log.notice(that.name + ':Stderr file at: ' + that.stderr_file);
						}
						cb(null, true);
					});
				},
				three : function (cb) {
					// excluding aof, since there is no server for the client to connect to.
					if (that.tags === 'auth') {
						that.client = redis.createClient(that.port, that.host, {
								no_ready_check : true
							});
						that.client.on('error', function (err) {
							s_callback(err, null);
						});
						that.client.on('ready', function (r) {
							if (debug_mode) {
								log.notice(that.name + ':Client connected and listening on socket: ' + that.host + ':' + that.port);
							}
							g.srv[cpid][that.server.pid]['client'] = that.client;
							cb(null, true);
						});
					} else if (that.tags != 'aof') {
						that.client = redis.createClient(that.port, that.host);
						that.client.on('error', function (err) {
							s_callback(err, null);
						});
						that.client.on('ready', function (r) {
							if (debug_mode) {
								log.notice(that.name + ':Client connected and listening on socket: ' + that.host + ':' + that.port);
							}
							g.srv[cpid][that.server.pid]['client'] = that.client;
							cb(null, true);
						});
					} else {
						cb(null, true);
					}
				},
				four : function (cb) {
					// checking the server actually started.
					var retrynum = 100;
					var serverisup = 0;
					var retval = 0;
					if (typeof s_callback == 'function' && that.tags != 'aof') {
						g.asyncFor(0, retrynum, function (loop) {
							that.client.ping(function (err, res) {
								if (err) {
									retval = 0;
									loop.next();
								} else if (res === 'PONG') {
									retval = 1;
									loop.break();
								}
							});
						}, function () {
							serverisup = retval;
							cb(null, true);
						});
					} else {
						serverisup = 1;
						cb(null, true);
					}
				},
				five : function (cb) {

					//setup properties to be able to initialize a client object

					g.srv[cpid][that.server.pid]['pid'] = that.server.pid;
					g.srv[cpid][that.server.pid]['config_file'] = that.config_file;
					g.srv[cpid][that.server.pid]['config'] = that.config;
					g.srv[cpid][that.server.pid]['stdout'] = that.stdout_file;
					g.srv[cpid][that.server.pid]['stderr'] = that.stderr_file;
					g.srv[cpid][that.server.pid]['stdout_stream'] = that.stdout_stream;
					g.srv[cpid][that.server.pid]['stderr_stream'] = that.stderr_stream;
					g.srv[cpid][that.server.pid]['tags'] = that.tags;
					g.srv[cpid][that.server.pid]['server'] = that.server;
					g.srv[cpid][that.server.pid]['host'] = that.host;
					g.srv[cpid][that.server.pid]['port'] = that.port;
					g.srv[cpid][that.server.pid]['name'] = that.name;

					cb(null, that.server.pid);
				},
			}, function (err, results) {
				if (err) {
					s_callback(err, null);
				} else {
					s_callback(null, results.five);
				}
			});
		});
	} catch (e) {
		console.log(e);
		s_callback(e, null);
	}
};

Server.prototype.kill_server = function (cpid, spid, k_callback) {
	var that = this;//k_callback(null, true);
	try {
		g.srv[cpid][spid]['stdout_stream'].close();
		g.srv[cpid][spid]['stdout_stream'].destroySoon();
		g.srv[cpid][spid]['stderr_stream'].close();
		g.srv[cpid][spid]['stderr_stream'].destroySoon();
		g.srv[cpid][spid]['server'].kill('SIGKILL');
		if (debug_mode) {
			log.notice(g.srv[cpid][spid]['name'] + ':Redis Server killed on socket : ' + g.srv[cpid][spid]['host'] + ':' + g.srv[cpid][spid]['port']);
		} 
		delete g.srv[cpid][spid];
		setTimeout(function () {
			k_callback(null, true);
		}, 200);
	} catch (e) {
		k_callback(e, null);
	}
};

Server.prototype.is_alive = function (pid, a_callback) {
	var check = child.exec(util.format(IS_ALIVE_CHECK, pid), function (error, stdout, stderr) {
			if (stdout.search(pid) !== -1) {
				a_callback(null, 1);
			} else
				a_callback(new Error('Server Not started'), null);
		});
};

module.exports = Server;