'use strict';

var nout = 123;

var loadNetwork = function () {
    var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(bestNetworkHash) {
        var keras_model, keras_model_meta, buffer, network, cn;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.next = 2;
                        return 0;
                    // return _context.abrupt('return', lastNetwork);

                    case 2:
                        _context.next = 4;
                        return loadJSON(bestNetworkHash + '.proto.json');

                    case 4:
                        keras_model = _context.sent;
                        _context.next = 7;
                        return loadJSON(bestNetworkHash + '.meta.json');

                    case 7:
                        keras_model_meta = _context.sent;
                        _context.next = 10;
                        return loadBuffer(bestNetworkHash + '.buf', {
                            progressContainer: document.querySelector('.progress')
                        });

                    case 10:
                        buffer = _context.sent;
                        _context.next = 11;

                        return import_keras_network(keras_model, keras_model_meta, buffer);

                    case 11:
                        network = _context.sent;
                        _context.next = 12;

                        var dat = new Float32Array(19 * 19 * 18);
                        var input = ndarray(dat, [19, 19, 18]); // .hi(null, null, 18).transpose(1, 0, 2).step(1, -1, 1);
                        return compile(gl, network, {
                            main_input: input,
                            layerPause: true,
                            progressContainer: document.querySelector('.progress')
                        });

                    case 12:
                        cn = _context.sent;
                        compiledNet = cn;
                        var dat = new Float32Array(19 * 19 * 18);
                        for (var i = 0; i < 19 * 19 * 18; i++) dat[i] = Math.cos(i);

                        var input = ndarray(dat, [18, 19, 19]); // .hi(null, null, 18).transpose(1, 0, 2).step(1, -1, 1);
                        var newinput = input.transpose(1, 2, 0); // true format
                        console.log(newinput);

                        myrun(gl, compiledNet, {
                            main_input: newinput,
                        });

                        var out = compiledNet.info['pol!fc'].output.read();
                        console.log(out);
                        var sum = 0.0;
                        for (i = 0; i < 19 * 19 + 1; i++) {
                            sum = sum + out.data[i];
                        }

                        nout = out;
                        console.log("SUM: ", sum);

                        return _context.abrupt('return', compiledNet);

                    case 15:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function loadNetwork(_x3) {
        return _ref.apply(this, arguments);
    };
}();

function _asyncToGenerator(fn) {
    return function () {
        var gen = fn.apply(this, arguments);
        return new Promise(function (resolve, reject) {
            function step(key, arg) {
                try {
                    var info = gen[key](arg);
                    var value = info.value;
                } catch (error) {
                    reject(error);
                    return;
                }
                if (info.done) {
                    resolve(value);
                } else {
                    return Promise.resolve(value).then(function (value) {
                        step("next", value);
                    }, function (err) {
                        step("throw", err);
                    });
                }
            }
            return step("next");
        });
    };
}

function kill_title() {
    var titleel = document.querySelector('.canvas-wrap.title');
    if (titleel) titleel.parentElement.removeChild(titleel);
}

var style = 'udnie';

var last = void 0;

var canvas = document.getElementById('stylize-canvas');
var gl = TF.createGL(canvas),
    OutputTensor = TF.OutputTensor,
    Tensor = TF.Tensor,
    InPlaceTensor = TF.InPlaceTensor;

var C;

var compiledNet = void 0;
var lastNetwork = void 0;

function formatNumber(number) {
    number = String(number).split('.');
    return number[0].replace(/(?=(?:\d{3})+$)(?!\b)/g, ',') + (number[1] ? '.' + number[1] : '');
}

var INBUG;
var forwardjs = function () {
    //
    var input = ndarray(inputarray, [19, 19, 18]);
    myrun(gl, compiledNet, {
        main_input: input
    });

    var o1 = compiledNet.info['pol!fc'].output.read().data;
    outputarray.set(o1, 0);
    var o2 = compiledNet.info['val!fc2+val!tanh'].output.read().data[0];
    outputarray[19 * 19 + 1] = o2;

    if (Math.abs(o2 + 0.426747) < 1e-6) {
        console.log(o1);
        console.log(o2);
        INBUG = inputarray.slice();
        console.log(inputarray);
    }

};

async function fetchNetworkHash() {
    console.log("Checking lastest network...");
    let response = await fetch('best-network-hash');
    let data = await response.text();
    let hash = data.split("\n")[0]

    if (hash != bestNetworkHash) {
        // initializing the board
        init();
        bestNetworkHash = hash;
        document.getElementById("hash").innerText = hash;
        console.log("Loading best network " + bestNetworkHash);
        await loadNetwork(bestNetworkHash).catch(err => {
            console.log('Error: ', err)
        });


        if (Module.sendcmd != null) {
            initGame();
            startGame();
            moveGame();
            isPlaying = true;
            console.log("Start the Game");
        }
    } else {
        console.log("Nah ... nothing new");
    }

    return data;
}

// Create cookie
function createCookie(name, value, days) {
    var expires;
    if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        expires = "; expires="+date.toGMTString();
    }
    else {
        expires = "";
    }
    document.cookie = name+"="+value+expires+"; path=/";
}

// Read cookie
function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') {
            c = c.substring(1,c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length,c.length);
        }
    }
    return null;
}

// Erase cookie
function eraseCookie(name) {
    createCookie(name,"",-1);
}


var count = readCookie("NGAME");

if (count == null) {
    createCookie("NGAME", "0", 365*10);
    count = "0"
}

var ncount = parseInt(count);

console.log("Number of played games:", ncount);
document.getElementById("numgame").innerText = String(ncount);

