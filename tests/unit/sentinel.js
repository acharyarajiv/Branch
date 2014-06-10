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

exports.Sentinel = (function () {
  //private properties
  var testEmitter = new events.EventEmitter(),
  sentinel_mod = require('node-sentinel'),
  ut = new Utility(),
  masterServer = new Server(),
  slaveServer = new Server(),
  server = new Server(),
  server1 = new Server(),
  sentinel = {},
  name = 'Sentinel',
  event_msg = '',
  event_Data = {},
  client = '',
  sentinel_cli = '',
  master_cli = '',
  slave_cli = '',
  sentinel_client = '',
  tester = {},
  server_pid = '',
  server_port = '',
  server_host = '',
  m_server_pid = '',
  m_server_port = '',
  m_server_host = '',
  s_server_pid = '',
  s_server_port = '',
  s_server_host = '',
  client_pid = '',
  all_tests = {};

  //public property
  sentinel.debug_mode = false;

  function attachEvents(s) {
    s.on('reset-master', function (data) {
      event_msg = 'reset-master';
      event_Data = data;
    });

    //A new slave was detected and attached.
    s.on('new-slave', function (data) {
      event_msg = 'new-slave';
      event_Data = data;
    });

    //A failover started by another Sentinel or any other external entity was detected (An attached slave turned into a master).
    s.on('failover-detected', function (data) {
      event_msg = 'failover-detected ' + '\n' + data;
    });

    s.on('slave-reconf-status', function (data) {
      switch (data.status) {

        //The leader sentinel sent the SLAVEOF command to this instance in order to reconfigure it for the new slave.
      case 'started':
        event_msg = 'started ';
        break;

        //The slave being reconfigured showed to be a slave of the new master ip:port pair, but the synchronization process is not yet complete.
      case 'in-progress':
        event_msg = 'in-progress ';
        break;

        //The slave is now synchronized with the new master.
      case 'done':
        event_msg = 'done ';
        break;

        //The failover aborted so we sent a SLAVEOF command to the specified instance to reconfigure it back to the original master instance.
      case 'aborted':
        event_msg = 'aborted ';
        break;
      }
      event_msg += '\n' + data;
    });

    //One or more sentinels for the specified master were removed as duplicated (this happens for instance when a Sentinel instance is restarted).
    s.on('dup-sentinel-removed', function (data) {
      event_msg = 'dup-sentinel-removed ' + '\n' + data;
    });

    //A new sentinel for this master was detected and attached.
    s.on('new-sentinel', function (data) {
      event_msg = 'new-sentinel';
    });

    //The specified instance is now in Subjectively Down state.
    s.on('instance-sdown', function (data) {
      event_msg = 'instance-sdown ' + '\n' + data;
    });

    //The specified instance is no longer in Subjectively Down state.
    s.on('instance-sdown-recover', function (data) {
      event_msg = 'instance-sdown-recover ' + '\n' + data;
    });

    //The specified instance is now in Objectively Down state.
    s.on('instance-odown', function (data) {
      event_msg = 'instance-odown ' + '\n' + data;
    });

    //The specified instance is no longer in Objectively Down state.
    s.on('instance-odown-recover', function (data) {
      event_msg = 'instance-odown-recover ' + '\n' + data;
    });

    //25% of the configured failover timeout has elapsed, but this sentinel can't see any progress, and is the new leader. It starts to act as the new leader reconfiguring the remaining slaves to replicate with the new master.
    s.on('failover-takedown', function (data) {
      event_msg = 'failover-takedown ' + '\n' + data;
    });

    //We are starting a new failover as a the leader sentinel.
    s.on('failover-triggered', function (data) {
      event_msg = 'failover-triggered ' + '\n' + data;
    });

    s.on('failover-status', function (data) {
      switch (data.status) {

        //New failover state is wait-start: we are waiting a fixed number of seconds, plus a random number of seconds before starting the failover.
      case 'wait-start':
        event_msg = 'wait-start ';
        break;

        //New failover state is select-slave: we are trying to find a suitable slave for promotion.
      case 'selecting-slave':
        event_msg = 'selecting-slave ';
        break;

        //We found the specified good slave to promote.
      case 'slave-selected':
        console.log('slave-selected');
        break;

        //We are trying to reconfigure the promoted slave as master, waiting for it to switch.
      case 'sent-slaveof-noone':
        event_msg = 'sent-slaveof-noone ';
        break;

        //Not documented
      case 'wait-promotion':
        event_msg = 'wait-promotion ';
        break;

        //Failover state changed to reconf-slaves state.
      case 'reconfigure-slaves':
        event_msg = 'reconfigure-slaves ';
        break;

        //The failover terminated with success. All the slaves appears to be reconfigured to replicate with the new master.
      case 'succeeded':
        event_msg = 'succeeded ';
        break;

        //There is no good slave to promote. Currently we'll try after some time, but probably this will change and the state machine will abort the failover at all in this case.
      case 'abort-no-good-slave-found':
        event_msg = 'abort-no-good-slave-found ';
        break;

        //Not documented
      case 'abort-master-is-back':
        event_msg = 'abort-master-is-back ';
        break;

        //The failover was undoed (aborted) because the promoted slave appears to be in extended SDOWN state.
      case 'abort-x-sdown':
        event_msg = 'abort-x-sdown ';
        break;
      }
      event_msg += '\n' + data;
    });

    //We are starting to monitor the new master, using the same name of the old one. The old master will be completely removed from our tables.
    s.on('switch-master', function (event) {
      event_msg = 'switch-master';
    });

    //Tilt mode entered.
    s.on('tilt-mode-entered', function (event) {
      event_msg = 'tilt-mode-entered';
    });

    //Tilt mode exited.
    s.on('tilt-mode-exited', function (event) {
      event_msg = 'tilt-mode-exited';
    });

    //Not documented
    s.on('promoted-slave', function (event) {
      event_msg = 'promoted-slave';
    });
  }
  //public method
  sentinel.start_test = function (cpid, callback) {
    testEmitter.on('start', function () {
      var tags = 'sentinel-master';
      var overrides = {};
      var args = {};
      args['name'] = name;
      args['tags'] = tags;
      args['overrides'] = overrides;
      client_pid = cpid;
      masterServer.start_server(cpid, args, function (err, res) {
        if (err) {
          callback(err, null);
        }
        m_server_pid = res;
        m_server_port = g.srv[cpid][m_server_pid]['port'];
        m_server_host = g.srv[cpid][m_server_pid]['host'];
        master_cli = g.srv[cpid][m_server_pid]['client'];
        args = {};
        args['name'] = 'Sentinel_Slave';
        args['tags'] = 'Sentinel_Slave';
        overrides['slave-priority'] = 10;
        overrides['repl-ping-slave-period'] = 30;
        overrides['repl-timeout'] = 120;
        args['overrides'] = overrides;
        slaveServer.start_server(cpid, args, function (err, res) {
          if (err) {
            callback(err, null);
          }
          s_server_pid = res;
          s_server_port = g.srv[cpid][s_server_pid]['port'];
          s_server_host = g.srv[cpid][s_server_pid]['host'];
          slave_cli = g.srv[cpid][s_server_pid]['client'];
          slave_cli.slaveof(m_server_host, m_server_port, function (err, res) {
            setTimeout(function () {
              args = {};
              overrides = {};
              args['name'] = 'Sentinel';
              args['tags'] = 'sentinel';
              overrides['sentinel monitor'] = 'mymaster1 ' + m_server_host + ' ' + m_server_port + ' 2';
              args['overrides'] = overrides;
              server.start_server(cpid, args, function (err, res) {
                if (err) {
                  callback(err, null);
                }
                server_pid = res;
                server_port = g.srv[cpid][server_pid]['port'];
                server_host = g.srv[cpid][server_pid]['host'];
                // we already have a client while checking for the server, we dont need it now.
                g.srv[cpid][server_pid]['client'].end();
                sentinel_cli = new sentinel_mod(server_host, server_port);
                attachEvents(sentinel_cli);
                if (sentinel.debug_mode) {
                  log.notice(name + ':Client disconnected listeting to socket : ' + g.srv[cpid][server_pid]['host'] + ':' + g.srv[cpid][server_pid]['port']);
                }
                all_tests = Object.keys(tester);
                testEmitter.emit('next');
              });
            }, 1000);
          });
        });
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
          testEmitter.emit('end');
        }
    });
    testEmitter.on('end', function () {
      master_cli.end();
      slave_cli.end();
      masterServer.kill_server(client_pid, m_server_pid, function (err, res) {
        if (err) {
          callback(err, null);
        } else if (res) {
          slaveServer.kill_server(client_pid, s_server_pid, function (err, res) {
            if (err) {
              callback(err, null);
            } else if (res) {
              server.kill_server(client_pid, server_pid, function (err, res) {
                if (err) {
                  callback(err, null);
                } else if (res) {
                  callback(null, true);
                }
              });
            }
          });
        }
      });
    });

    if (sentinel.debug_mode) {
      server.set_debug_mode(true);
    }

    testEmitter.emit('start');
  }

  //testMethods methods
  tester.sentinel1 = function (errorCallback) {
    var test_case = 'API returns PONG on PING';
    sentinel_cli.ping(function (err, pong) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(pong, 'PONG', test_case);
      testEmitter.emit('next');
    });
  }

  tester.sentinel2 = function (errorCallback) {
    var test_case = 'Master Info';
    sentinel_cli.masters(function (err, masters) {
      if (err) {
        errorCallback(err);
      }
      ut.assertEqual(masters[0]['name'], 'mymaster1', test_case);
      testEmitter.emit('next');
    });
  }

  tester.sentinel3 = function (errorCallback) {
    var test_case = 'Get Master Address';
    sentinel_cli.getMasterAddress('mymaster1', function (err, masterInfo) {
      ut.assertMany(
        [
          ['equal', masterInfo['ip'], m_server_host],
          ['equal', masterInfo['port'], m_server_port]
        ], test_case);
      testEmitter.emit('next');
    });
  }

  tester.sentinel4 = function (errorCallback) {
    var test_case = 'Check if master is down';
    sentinel_cli.isMasterDown(m_server_host, m_server_port.toString(), function (err, isMasterDown) {
      ut.assertEqual(isMasterDown['isDown'].toString(), 'false', test_case);
      testEmitter.emit('next');
    });
  }

  tester.sentinel5 = function (errorCallback) {
    var test_case = 'Check if a server is leader';
    sentinel_cli.isLeader(m_server_host, m_server_port.toString(), function (err, isLeader) {
      ut.assertEqual(isLeader.toString(), 'false', test_case);
      testEmitter.emit('next');
    });
  }

  tester.sentinel6 = function (errorCallback) {
    var test_case = 'Slave Info';
    sentinel_cli.slaves('mymaster', function (errMsg, res) {
      sentinel_cli.slaves('mymaster1', function (err, slavesInfo) {
        ut.assertMany(
          [
            ['ok', 'No such master', errMsg],
            ['equal', slavesInfo[0]['port'], s_server_port]
          ], test_case);
        testEmitter.emit('next');
      });
    });
  }

  tester.sentinel7 = function (errorCallback) {
    var test_case = 'Detect and Recognize newly attached Sentinel with config';
    args = {};
    overrides = {};
    args['name'] = 'Sentinel';
    args['tags'] = 'sentinel';
    overrides['sentinel monitor'] = 'mymaster1 ' + m_server_host + ' ' + m_server_port + ' 2';
    overrides['sentinel down-after-milliseconds'] = 'mymaster1 40000';
    overrides['sentinel can-failover'] = 'mymaster1 yes';
    overrides['sentinel failover-timeout'] = 'mymaster1 900000';
    overrides['sentinel parallel-syncs'] = 'mymaster1 2';
    args['overrides'] = overrides;
    server1.start_server(client_pid, args, function (err, res) {
      if (err) {
        errorCallback(err, null);
      }
      g.srv[client_pid][res]['client'].end();
      sentinel_cli.on('new-sentinel', function (data) {
        sentinel_cli.sentinels('mymaster1', function (err, sentinels) {
          ut.assertMany(
            [
              ['equal', event_msg, 'new-sentinel'],
              ['equal', data['details']['master-name'], 'mymaster1'],
              ['equal', sentinels[0]['ip'], m_server_host],
              ['equal', sentinels[0]['port'], data['details']['port']],
              ['equal', data['details']['port'], g.srv[client_pid][res]['port']]
            ], test_case);
          server1.kill_server(client_pid, res, function (err, res) {
            testEmitter.emit('next');
          });
        });
      });
    });
  }

  tester.sentinel8 = function (errorCallback) {
    var test_case = 'Reset Master';
    event_msg = '';
    event_Data = {};
    sentinel_cli.reset('mymaster1', function (err, success) {
      if (err) {
        errorCallback(err);
      }
      ut.assertMany(
        [
          ['ok', success, null],
          ['ok', 'reset-master', event_msg],
          ['ok', 'mymaster1', event_Data['details']['name']]
        ], test_case);
      testEmitter.emit('next');
    });
  }

  return sentinel;

}
  ());
