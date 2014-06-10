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

exports.Limits = (function () {
  // private properties
  var testEmitter = new events.EventEmitter(),
  ut = new Utility(),
  server = new Server(),
  limits = {},
  name = 'Limits',
  client = '',
  tester = {},
  server_pid = '',
  all_tests = '',
  server_host = '',
  server_port = '',
  client_pid = '';

  //public property
  limits.debug_mode = false;

  limits.start_test = function (cpid, callback) {
    testEmitter.on('start', function () {
      var tags = 'limits';
      var overrides = {};
      overrides['maxclients'] = 10;
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
      setTimeout(function () {
        var test_case_name = all_tests.shift();
        if (test_case_name) {
          tester[test_case_name](function (error) {
            ut.fail(error);
            testEmitter.emit('next');
          });
        } else {
          client.end();
          if (limits.debug_mode) {
            log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[client_pid][server_pid]['host'] + ':' + g.srv[client_pid][server_pid]['port']);
          }
          testEmitter.emit('end');
        }
      }, ut.timeout);
    });
    if (limits.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  tester.limits1 = function (errorCallback) {
    var test_case = 'Check if maxclients works refusing connections';
    var c = 0,
    iLoopIndex = 0;
    var newClient = '';
    g.asyncFor(0, 12, function (loop) {
      iLoopIndex = loop.iteration();
      setTimeout(function () {
        newClient = redis.createClient(server_port, server_host);
        newClient.on('ready', function () {
          newClient.ping(function (err, res) {
            if (err) {
              loop.break();
            }
            c++;
            loop.next();
          });
        });
        newClient.on('error', function (err, res) {
          loop.next();
        });
      }, 100);
    }, function () {
      ut.assertOk(c > 8 && c <= 10, null, test_case);
      newClient.end();
      testEmitter.emit('next');
    });
  };
  
  return limits;
}
  ());
