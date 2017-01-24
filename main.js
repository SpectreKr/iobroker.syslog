'use strict';

var utils    = require(__dirname + '/lib/utils'); // Get common adapter utils

var adapter = utils.adapter('syslog');
var mysql = require('mysql');

var client;
var tempIndex;
var strQuery;
var keys = [];


adapter.on('unload', function (callback) {
    finish(callback);
});

adapter.on('ready', function () {
    main();
});

adapter.on('stateChange', function (id, state) {
    if(id === 'syslog.0.MaxIndex'){
        adapter.getState(adapter.namespace + '.LastIndex', function (err, state){
            if (state){
                tempIndex = state.val;
            }
            adapter.log.debug("Old index: " + tempIndex);
        });
        if(tempIndex < state.val) {
            notifyUser(tempIndex, state.val);
//            tempIndex = state.val;
        }
    }
});

process.on('SIGINT', function () {
    // close connection to DB
    finish();
});

function connect() {

    client = mysql.createConnection({
        host:       adapter.config.host,
        user:       adapter.config.user,
        password:   adapter.config.password,
        database:   adapter.config.dbname
    });

    client.connect(function(err) {
        if (err) {
            adapter.log.error('error connecting: ' + err.stack);
            return;
        }
        adapter.log.info('connected as id ' + client.threadId);
    });

    if(adapter.config.keywords.length > 0){
        keys = adapter.config.keywords.split(',');
    }



}

function testConnection(msg) {

/*
    var timeout;
    try {
        client.query("SELECT max(id) AS id FROM SystemEvents", function (err, rows, fields) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
                return adapter.sendTo(msg.from, msg.command, {error: err ? err.toString() : null}, msg.callback);
            }
        });
    } catch (ex) {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        if (ex.toString() === 'TypeError: undefined is not a function') {
            return adapter.sendTo(msg.from, msg.command, {error: 'Node.js DB driver could not be installed.'}, msg.callback);
        } else {
            return adapter.sendTo(msg.from, msg.command, {error: ex.toString()}, msg.callback);
        }
    }
    */
}

function finish(callback) {
    if (client) {
        client.end();
    }
    if (callback)   callback();
}

function main() {
    connect();

    adapter.subscribeStates('*');

    adapter.setObject('LastIndex', {
        type: 'state',
        common: {
            name: 'LastIndex',
            type: 'integer',
            role: 'indicator'
        },
        native: {}
    });

    adapter.setObject('MaxIndex', {
        type: 'state',
        common: {
            name: 'MaxIndex',
            type: 'integer',
            role: 'indicator'
        },
        native: {}
    });

    adapter.setObject('Message', {
        type: 'state',
        common: {
            name: 'Message',
            type: 'string',
            role: 'indicator'
        },
        native: {}
    });

    adapter.getState(adapter.namespace + '.LastIndex', function (err, state){
        if (state){
            tempIndex = state.val;
        }
        adapter.log.debug("Old index: " + tempIndex);
    });
}

//получаем последдний ID
function GetId(){
    adapter.log.debug("Query max ID");
    client.query('SELECT max(id) AS id FROM SystemEvents', function(err, res_id, fields) {
        if (!err) {
            adapter.setState('MaxIndex', {val: res_id[0].id, ack: true});
            adapter.log.debug("New index:" + JSON.stringify(res_id[0].id));
            adapter.setState('LastIndex', {val: res_id[0].id, ack: true});
        } else {
            adapter.log.error(err);
            adapter.finish();
            adapter.connect();
            return;
        }
    })
}

setInterval(GetId, 30000);

function notifyUser (oldIndex, newIndex){
    strQuery = "SELECT DeviceReportedTime, Priority, SysLogTag, FromHost, Message  FROM SystemEvents WHERE id BETWEEN " + oldIndex +" AND " + newIndex +
                    " AND priority BETWEEN 1 AND 4";
    adapter.log.debug(strQuery);
    client.query(strQuery, function(err, res_id, fields) {
        if (!err) {
            var col = res_id.length;
            if(col > 0){
                adapter.log.debug(JSON.stringify(res_id[0]));
                for( var a = 0; a < col; a++) {
                    adapter.log.debug(JSON.stringify(res_id[a]));
                    setNotify(res_id[a], newIndex);
//                sendTo('telegram', JSON.stringify(res_id[a]));
                }
            }
        } else {
            adapter.log.error(err);
            adapter.finish;
            adapter.connect;
            return;
        }
    });
}

function setNotify(str, ind) {
    adapter.log.debug('Set JSON message');
    var pr;
    switch(str.Priority){
        case 0:
            pr = "Emerg";
        break;
        case 1:
            pr = "Alert";
        break;
        case 2:
            pr = "Critical";
        break;
        case 3:
            pr = "Error";
        break;
        case 4:
            pr = "Warn";
        break;
        case 5:
            pr = "Notice";
        break;
        case 6:
            pr = "Info";
        break;
        case 7:
            pr = "Debug";
        break;
    }
    var sendmes;
    sendmes = {
        "time": str.DeviceReportedTime,
        "hosts": str.FromHost,
        "service": str.SyslogTag,
        "type": pr,
        "message": str.Message
    };
    adapter.getState(adapter.namespace + '.Message', function (err, state){
        adapter.log.debug("Message val: " + JSON.stringify(state))
        var old_state = JSON.parse(state.val);
        var old_mes = old_state.message.substring(old_state.message.indexOf(']')+1);
        var new_mes = str.Message.substring(str.Message.indexOf(']')+1);
        adapter.log.debug("Old: " + old_mes);
        adapter.log.debug("New: " + new_mes);
        if(old_mes == new_mes){
            adapter.log.debug("Dublicat!");
        }else
        if (state != "" || state.val != sendmes || state === null){
            adapter.setState('Message', {val: JSON.stringify(sendmes), ack: true});
            adapter.log.debug(JSON.stringify(sendmes));
            sendmes = '';
        }
    });
//    adapter.setState('LastIndex', {val: ind, ack: true});
}