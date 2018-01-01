// Copyright 2015-2018 the project authors as listed in the AUTHORS file.
// All rights reserved. Use of this source code is governed by the
// license that can be found in the LICENSE file.
const fs = require('fs');
const mqtt = require('mqtt');
const net = require('net');
const socketio = require('socket.io');
const wemore = require('wemore');

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 200;

var eventSocket = null;

const Server = function() {
}


Server.getDefaults = function() {
  return { 'title': 'alexa devide bridge' };
}

var replacements;
Server.getTemplateReplacments = function() {
  if (replacements === undefined) {
    let config = Server.config;

    replacements = [{ 'key': '<DASHBOARD_TITLE>', 'value': Server.config.title },
                    { 'key': '<UNIQUE_WINDOW_ID>', 'value': Server.config.title },
                    { 'key': '<PAGE_WIDTH>', 'value': PAGE_WIDTH },
                    { 'key': '<PAGE_HEIGHT>', 'value': PAGE_HEIGHT }];

  }
  return replacements;
}


const recentActivity = new Array()
const pushActivity = function(entry) {
  var newEntry = new Date() + ':' + entry;
  recentActivity.push(newEntry);
  console.log(newEntry);
  eventSocket.emit('recent_activity', newEntry);
  if (recentActivity.length > Server.config.MaxRecentActivity) {
    recentActivity.splice(0,1);
  }
}

Server.startServer = function(server) {
  eventSocket = socketio.listen(server);

  eventSocket.on('connection', function(client) {
    for (var i = 0; i < recentActivity.length; i++) {
      eventSocket.to(client.id).emit('recent_activity', recentActivity[i]);
    }
  });

  // setup mqtt
  var mqttOptions;
  if (Server.config.mqttServerUrl.indexOf('mqtts') > -1) {
    mqttOptions = { key: fs.readFileSync(path.join(__dirname, 'mqttclient', '/client.key')),
                    cert: fs.readFileSync(path.join(__dirname, 'mqttclient', '/client.cert')),
                    ca: fs.readFileSync(path.join(__dirname, 'mqttclient', '/ca.cert')),
                    checkServerIdentity: function() { return undefined }
    }
  }

  var mqttClient = mqtt.connect(Server.config.mqttServerUrl, mqttOptions);
  mqttClient.on('connect', function() {
    pushActivity('Connected to mqtt server');
  });

  // read in and setup the devices to be eumlated
  Server.config.devices.map(function(config) {
    const device = wemore.Emulate({ friendlyName: config.name, port: config.port });
    device.on('on', function() {
      mqttClient.publish(config.actions.on.topic, config.actions.on.message);
      pushActivity(config.name + ':' + 'on');
    });

    device.on('off', function() {
      mqttClient.publish(config.actions.off.topic, config.actions.off.message);
      pushActivity(config.name + ':' + 'off');
    });
  });
}


if (require.main === module) {
  const path = require('path');
  const microAppFramework = require('micro-app-framework');
  microAppFramework(path.join(__dirname), Server);
}

module.exports = Server;
