![Logo](admin/syslog.png)
# ioBroker.syslog
==================================
[![NPM version](http://img.shields.io/npm/v/iobroker.syslog.svg)](https://www.npmjs.com/package/iobroker.syslog)
[![Downloads](https://img.shields.io/npm/dm/iobroker.syslog.svg)](https://www.npmjs.com/package/iobroker.syslog)
[![Tests](https://travis-ci.org/ioBroker/ioBroker.syslog.svg?branch=master)](https://travis-ci.org/ioBroker/ioBroker.syslog)

[![NPM](https://nodei.co/npm/iobroker.syslog.png?downloads=true)](https://nodei.co/npm/iobroker.syslog/)

Настраиваем подключение к Mysql серверу, в котором храняться логи.

В JavaScript драйвере создаем скрипт.

```
on({id: 'syslog.0.Message', change: 'ne'}, function (obj) {
    var text = JSON.parse(obj.newState.val);
    sendTo('telegram', {user: 'Имя', text: "time: " + formatDate(new Date(text.time), 'DD.MM.YYYY hh:mm') + '\n' +
                                                "host: " + text.hosts + '\n' + "type: " + text.type  + '\n' +
                                                "message: " + text.message});
});
```

### 0.0.1 (2017-01-24)
* (spectrekr) initial commit

## License

The MIT License (MIT)

Copyright (c) 2015 bluefox

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
