'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var loadArrayFromURL = function () {
    var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(fileName, opts) {
        var buffer, shape;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.t0 = Float32Array;
                        _context.next = 3;
                        return loadBuffer(fileName, opts);

                    case 3:
                        _context.t1 = _context.sent;
                        buffer = new _context.t0(_context.t1);
                        shape = fileName.match(/\d+(x\d+)*$/)[0].split('x').map(function (k) {
                            return +k;
                        });
                        return _context.abrupt('return', ndarray(buffer, shape));

                    case 7:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function loadArrayFromURL(_x, _x2) {
        return _ref.apply(this, arguments);
    };
}();

// function createProgress(label, container){
//     const prog = document.createElement('div')
//     prog.style = `
//         width: 0;
//         height: 2px;
//         background: #8BC77C;
//     `

//     label = document.createTextNode(label || '')

//     let destroy = () => (container.removeChild(prog), container.removeChild(label))

//     if(!container){
//         container = document.body.appendChild(document.createElement('div'))
//         container.style = `
//             position: absolute;
//             top: 0;
//             left: 0;
//             width: 100%;
//             padding: 20px;
//             boxSizing: border-box;
//         `
//         destroy = () => document.body.removeChild(container)
//     }

//     container.appendChild(label)
//     container.appendChild(prog)

//     return {
//         set value(n){
//             prog.style.width = n*100+'%'
//         },
//         destroy
//     }
// }

var loadBuffer = function () {
    var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2(fileName) {
        var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
            progressContainer = _ref3.progressContainer;

        var xhr, prog;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        xhr = new XMLHttpRequest();

                        xhr.open('GET', fileName, true);
                        xhr.responseType = 'arraybuffer';
                        xhr.send(null);

                        prog = createProgress('downloading model', progressContainer);

                        xhr.onprogress = function (progress) {
                            prog.value = progress.loaded / progress.total;
                        };

                        _context2.next = 8;
                        return new Promise(function (resolve) {
                            return xhr.onload = resolve;
                        });

                    case 8:
                        prog.destroy();

                        return _context2.abrupt('return', xhr.response);

                    case 10:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function loadBuffer(_x3) {
        return _ref2.apply(this, arguments);
    };
}();

var loadJSON = function () {
    var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(fileName) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.next = 2;
                        return fetch(fileName);

                    case 2:
                        _context3.next = 4;
                        return _context3.sent.json();

                    case 4:
                        return _context3.abrupt('return', _context3.sent);

                    case 5:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this);
    }));

    return function loadJSON(_x5) {
        return _ref4.apply(this, arguments);
    };
}();

var loadImage = function () {
    var _ref5 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4(url) {
        var image, canvas, ctx;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        image = new Image(), canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');

                        image.src = url;
                        _context4.next = 4;
                        return new Promise(function (resolve) {
                            image.onload = function () {
                                canvas.width = image.naturalWidth;
                                canvas.height = image.naturalHeight;
                                ctx.drawImage(image, 0, 0);
                                resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
                            };
                        });

                    case 4:
                        return _context4.abrupt('return', _context4.sent);

                    case 5:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function loadImage(_x6) {
        return _ref5.apply(this, arguments);
    };
}();

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function createProgress(label, container) {
    return {
        set value(n) {
        },
        destroy: function destroy() {
        }
    };
}

function h(type) {
    var children = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    var el = document.createElement(type);
    (Array.isArray(children) ? children : [children]).forEach(function (k) {
        return el.appendChild((typeof k === 'undefined' ? 'undefined' : _typeof(k)) != 'object' ? document.createTextNode(k) : k);
    });
    return el;
}