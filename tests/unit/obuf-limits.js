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
      setTimeout(function () {
        var test_case_name = all_tests.shift();
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
      }, ut.timeout);
    });
    if (obuf_limits.debug_mode) {
      server.set_debug_mode(true);
    }
    testEmitter.emit('start');
  }

  //test methods
  tester.obuf_limits1 = function (errorCallback) {
    var test_case = 'Client output buffer hard limit is enforced';
    client.config('set', 'client-output-buffer-limit', 'pubsub 100000 0 0', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var newClient = redis.createClient(server_port, server_host);
      newClient.on("error", function (msg) {});
      newClient.subscribe('foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        var i = 0,
        omem = 0,
        batchPublish = 8000,
        testpass = false;
        try {
          if (!assert.ok(ut.match(res, 'subscribe foo 1'), test_case)) {
            /*
             * execute publish command in a batch
             * get the client list properties
             * and check for omem value
             * assert the value. If not	true then increase the batch size and redo the above three line
             * This tweak is implemented since the async calls made by publish and client list commands,
             * give enough time for redis to read and clear the output buffer and hence neither omem nor obl value
             * increase. Instead of waiting for reply on publish and then publishing again after the reply
             * publish commands are sent which are queued
             * in buffer memory and thus causing increasing in OBL and omem properties
             */
            g.asyncFor(0, 10, function (outerloop) {
              g.asyncFor(0, -1, function (loop) {

                //reading client list
                client.client('list', function (err, res) {
                  clients = res.split('\n');
                  if (clients[1]) {
                    c = clients[1].split(' ');
                    omem = c[14].split('=')[1];
                    if (omem <= 200000) {
                      i = 0;
                      while (i++ < batchPublish)
                        client.publish('foo', 'bar');

                      loop.next();
                    } else
                      loop.break();
                  } else {
                    loop.break();
                  }
                });
              }, function () {
                if (omem >= 99000 && omem < 200000) {
                  testpass = true;
                  outerloop.break();
                } else {
                  setTimeout(function () {
                    batchPublish += 200;
                    outerloop.next();
                  }, 1000);
                }
              });
            }, function () {
              if (testpass)
                ut.pass(test_case);
              else
                ut.fail('Client output buffer hard limit is not enforced', true);
              newClient.end();
              testEmitter.emit('next');
            });

          }
        } catch (e) {
          newClient.end();
          ut.fail(e, true);
          testEmitter.emit('next');
        }
      });
    });
  }

  tester.obuf_limits2 = function (errorCallback) {
    var test_case = 'Client output buffer soft limit is not enforced if time is not overreached';
    var i = 0,
    start_time = 0,
    time_elapsed = 0,
    omem = 0,
    batchPublish = 8000,
    testpass = false;
    client.config('set', 'client-output-buffer-limit', 'pubsub 0 100000 10', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var newClient = redis.createClient(server_port, server_host);
      newClient.on("error", function (msg) {});
      newClient.subscribe('foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        try {
          if (!assert.ok(ut.match(res, 'subscribe foo 1'), test_case)) {
            /*
             * execute publish command in a batch
             * get the client list properties
             * and check for omem value
             * assert the value. If not	true then increase the batch size and redo the above three line
             * This tweak is implemented since the async calls made by publish and client list commands,
             * give enough time for redis to read and clear the output buffer and hence neither omem nor obl value
             * increase. Instead of waiting for reply on publish and then publishing again after the reply
             * publish commands are sent which are queued
             * in buffer memory and thus causing increasing in OBL and omem properties
             */
            g.asyncFor(0, 10, function (outerloop) {
              g.asyncFor(0, -1, function (loop) {
                client.client('list', function (err, res) {
                  if (err) {
                    errorCallback(err);
                  }
                  clients = res.split('\n');
                  if (clients[1]) {
                    i = 0;
                    while (i++ < batchPublish)
                      client.publish('foo', 'bar');

                    c = clients[1].split(' ');
                    omem = c[14].split('=')[1];
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
                if (omem >= 100000 && time_elapsed >= 5 && time_elapsed <= 10) {
                  testpass = true;
                  outerloop.break();
                } else {
                  setTimeout(function () {
                    batchPublish += 100;
                    outerloop.next();
                  }, 1000);
                }
              });
            }, function () {
              if (testpass)
                ut.pass(test_case);
              else
                ut.fail('Client output buffer soft limit enforcing failed', true);
              newClient.end();
              testEmitter.emit('next');
            });
          }
        } catch (e) {
          newClient.end();
          ut.fail(e, true);
          testEmitter.emit('next');
        }
      });
    });
  }

  tester.obuf_limits3 = function (errorCallback) {
    var test_case = 'Client output buffer soft limit is enforced if time is overreached';
    var i = 0,
    start_time = 0,
    time_elapsed = 0,
    omem = 0,
    batchPublish = 5000,
    testpass = false;
    client.config('set', 'client-output-buffer-limit', 'pubsub 0 100000 3', function (err, res) {
      if (err) {
        errorCallback(err);
      }
      var newClient = redis.createClient(server_port, server_host);

      newClient.on("error", function (msg) {
        if (obuf_limits.debug_mode) {
          console.log(msg);
        }
      });

      newClient.subscribe('foo', function (err, res) {
        if (err) {
          errorCallback(err);
        }
        try {
          if (!assert.ok(ut.match(res, 'subscribe foo 1'), test_case)) {
            /*
             * execute publish command in a batch
             * get the client list properties
             * and check for omem value
             * assert the value. If not	true then increase the batch size and redo the above three line
             * This tweak is implemented since the async calls made by publish and client list commands,
             * give enough time for redis to read and clear the output buffer and hence neither omem nor obl value
             * increase. Instead of waiting for reply on publish and then publishing again after the reply
             * publish commands are sent which are queued
             * in buffer memory and thus causing increasing in OBL and omem properties
             */
            g.asyncFor(0, 10, function (outerloop) {
              g.asyncFor(0, -1, function (loop) {
                i = 0;
                while (i++ < batchPublish)
                  client.publish('foo', 'bar');

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
                      omem = c[14].split('=')[1];
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
                if (omem >= 100000 && time_elapsed < 6) {
                  testpass = true;
                  outerloop.break();
                } else {
                  setTimeout(function () {
                    batchPublish += 100;
                    outerloop.next();
                  }, 1000);
                }
              });
            }, function () {
              if (testpass)
                ut.pass(test_case);
              else
                ut.fail('Client output buffer soft limit is not enforced', true);
              newClient.end();
              testEmitter.emit('next');
            });
          }
        } catch (e) {
          newClient.end();
          ut.fail(e, true);
          testEmitter.emit('next');
        }
      });
    });
  }

  return obuf_limits;
}

  ());