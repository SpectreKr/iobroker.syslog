'use strict';

var utils    = require(__dirname + '/lib/utils'); // Get common adapter utils

var adapter = utils.adapter('syslog');
var mysql = require('mysql');

var client;
var tempIndex;
var strQuery;
var keys = [], type_event = [];
var timeout;


adapter.on('unload', function (callback) {
    finish(callback);
});

adapter.on('ready', function () {
    main();
});

adapter.on('message', function (msg) {
    processMessage(msg);
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

    try{
        client.connect(function(){
            adapter.log.info('connected as id ' + client.threadId);
        });
    }catch (e){
        adapter.log.error('error connecting: ' + e.toString());
    }


    if(adapter.config.keywords.length > 0){
        keys = adapter.config.keywords.split(',');
    }

    if(adapter.config.t_emerg){
        type_event.push(0);
    }
    if(adapter.config.t_alert){
        type_event.push(1);
    }
    if(adapter.config.t_critical){
        type_event.push(2);
    }
    if(adapter.config.t_error){
        type_event.push(3);
    }
    if(adapter.config.t_warn){
        type_event.push(4);
    }
    if(adapter.config.t_notice){
        type_event.push(5);
    }
    if(adapter.config.t_info){
        type_event.push(6);
    }
    if(adapter.config.t_debug){
        type_event.push(7);
    }
}

function testConnection(msg) {

    try {
        var client_test;
        timeout = setTimeout(function () {
            timeout = null;
            adapter.sendTo(msg.from, msg.command, {error: 'connect timeout'}, msg.callback);
        }, 5000);

        client_test = mysql.createConnection({
            host:       adapter.config.host,
            user:       adapter.config.user,
            password:   adapter.config.password,
            database:   adapter.config.dbname
        });

        client_test.connect(function (err) {
            if (err) {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                return adapter.sendTo(msg.from, msg.command, {error: err.toString()}, msg.callback);
            }
            client_test.query("SELECT max(id) AS id FROM SystemEvents", function (err, rows, fields) {
                client_test.end();
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                    return adapter.sendTo(msg.from, msg.command, {error: err ? err.toString() : null}, msg.callback);
                }
            });
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

}

function finish(callback) {
        client.end();
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
    try {
        client.query('SELECT max(id) AS id FROM SystemEvents', function (err, res_id, fields) {
            if (!err) {
                adapter.setState('MaxIndex', {val: res_id[0].id, ack: true});
                adapter.log.debug("New index:" + JSON.stringify(res_id[0].id));
                adapter.setState('LastIndex', {val: res_id[0].id, ack: true});
            }else{
                adapter.log.error(e.toString());
                adapter.finish();
                adapter.connect();
            }
        });
    } catch (e) {
        adapter.log.error(e.toString());
        adapter.finish();
        adapter.connect();
    }
}

setInterval(GetId, 30000);

function notifyUser (oldIndex, newIndex){
    try{
        if (keys.length > 0){
            for(var b in keys) {
                strQuery = "SELECT DeviceReportedTime, Priority, SysLogTag, FromHost, Message  FROM SystemEvents WHERE id BETWEEN " + oldIndex + " AND " + newIndex +
                    " AND (SysLogTag LIKE ('%" + keys[b] + "%') OR priority IN (" + type_event + "))";
                send_query(strQuery, newIndex);
            }
        }else{
            strQuery = "SELECT DeviceReportedTime, Priority, SysLogTag, FromHost, Message  FROM SystemEvents WHERE id BETWEEN " + oldIndex +" AND " + newIndex +
                " AND priority IN (" + type_event + ")";
            send_query(strQuery, newIndex);
        }
    } catch(e){
        adapter.log.error(e.toString());
        adapter.finish;
        adapter.connect;
    }

}

function send_query(str, index){
    adapter.log.debug(strQuery);
    try {
        client.query(strQuery, function (err, res_id, fields) {
            if (!err) {
                var col = res_id.length;
                if (col > 0) {
                    adapter.log.debug(JSON.stringify(res_id[0]));
                    for (var a = 0; a < col; a++) {
                        adapter.log.debug(JSON.stringify(res_id[a]));
                        setNotify(res_id[a], index);
                    }
                }
            }
        });
    } catch (e) {
        adapter.log.error(e.toString());
        adapter.finish;
        adapter.connect;
    }
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
        var old_state, old_m, new_m;
        adapter.log.debug("Message val: " + JSON.stringify(state))
        if (state === "" || state === null){
            adapter.setState('Message', {val: JSON.stringify(sendmes), ack: true});
            adapter.log.debug(JSON.stringify(sendmes));
            sendmes = '';
        }else{
            old_state = JSON.parse(state.val);
            old_m = old_state.message.substring(str.Message.indexOf(']')+1);
            new_m = str.Message.substring(str.Message.indexOf(']')+1);
            adapter.log.debug("Old: " + old_m);
            adapter.log.debug("New: " + new_m);
            if(old_m === new_m) {
                adapter.log.debug("Dublicat!");
	    }else{
		adapter.log.info(new_m.indexOf("error: WARNING: cannot find message with id"));
		if(new_m.indexOf("error: WARNING: cannot find message with id") >= 0 ){
			adapter.log.debug(JSON.stringify(sendmes));
		}else{
			adapter.setState('Message', {val: JSON.stringify(sendmes), ack: true});
			adapter.log.info(JSON.stringify(sendmes));
			sendmes = '';
		}
            }
        }
    });
}

function processMessage(msg) {
    if (msg.command === 'test') {
        testConnection(msg);
    }
}