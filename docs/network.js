'use strict';

var compile = function () {
    var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(gl, network, options) {
        var info, finished, prog, lastFrame, pending, ready, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, layer, deps, dep;

        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        info = {};


                        console.time('compiling network');
                        finished = 0;

                        console.groupCollapsed('compiling');

                        if (options.layerPause) prog = createProgress('compiling network', options.progressContainer);

                        lastFrame = Date.now();

                    case 6:
                        if (!true) {
                            _context.next = 54;
                            break;
                        }

                        pending = network.filter(function (k) {
                            return !(k.name in info);
                        });
                        ready = pending.filter(function (k) {
                            return Object.values(k.deps).every(function (e) {
                                return e in info;
                            });
                        });

                        if (!(ready.length == 0)) {
                            _context.next = 13;
                            break;
                        }

                        if (!(pending.length > 0)) {
                            _context.next = 12;
                            break;
                        }

                        throw new Error("Finished with layers still pending.");

                    case 12:
                        return _context.abrupt('break', 54);

                    case 13:
                        _iteratorNormalCompletion = true;
                        _didIteratorError = false;
                        _iteratorError = undefined;
                        _context.prev = 16;
                        _iterator = ready[Symbol.iterator]();

                    case 18:
                        if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                            _context.next = 38;
                            break;
                        }

                        layer = _step.value;
                        deps = {};

                        for (dep in layer.deps) {
                            deps[dep] = info[layer.deps[dep]].output;
                        }

                        info[layer.name] = LAYER_TYPES[layer.type](gl, layer, deps, options);
                        info[layer.name].deps = deps;
                        finished++;

                        if (!options.layerPause) {
                            _context.next = 32;
                            break;
                        }

                        prog.value = finished / network.length;

                        if (!(Date.now() - lastFrame > 10)) {
                            _context.next = 32;
                            break;
                        }

                        _context.next = 31;
                        return new Promise(function (resolve) {
                            return requestAnimationFrame(resolve);
                        });

                    case 31:
                        lastFrame = Date.now();

                    case 32:
                        if (!options.progress) {
                            _context.next = 35;
                            break;
                        }

                        _context.next = 35;
                        return options.progress(finished / network.length, layer);

                    case 35:
                        _iteratorNormalCompletion = true;
                        _context.next = 18;
                        break;

                    case 38:
                        _context.next = 44;
                        break;

                    case 40:
                        _context.prev = 40;
                        _context.t0 = _context['catch'](16);
                        _didIteratorError = true;
                        _iteratorError = _context.t0;

                    case 44:
                        _context.prev = 44;
                        _context.prev = 45;

                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }

                    case 47:
                        _context.prev = 47;

                        if (!_didIteratorError) {
                            _context.next = 50;
                            break;
                        }

                        throw _iteratorError;

                    case 50:
                        return _context.finish(47);

                    case 51:
                        return _context.finish(44);

                    case 52:
                        _context.next = 6;
                        break;

                    case 54:
                        console.groupEnd('compiling');
                        console.timeEnd('compiling network');

                        if (options.layerPause) prog.destroy();

                        return _context.abrupt('return', {
                            network: network,
                            info: info
                        });

                    case 58:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this, [
            [16, 40, 44, 52],
            [45, , 47, 51]
        ]);
    }));

    return function compile(_x, _x2, _x3) {
        return _ref.apply(this, arguments);
    };
}();

var myrun = function () {
    var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2(gl, compiled, options) {
        var network, info, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, _layer, lastFrame, pending, ready, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, layer, size;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:

                        // reset status of all layers

                        _iteratorNormalCompletion2 = true;
                        _didIteratorError2 = false;
                        _iteratorError2 = undefined;
                        _context2.prev = 4;

                        if (compiled == null) {
                            return _context2.stop();
                        }
                        network = compiled.network, info = compiled.info;
                        for (_iterator2 = network[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                            _layer = _step2.value;

                            info[_layer.name].done = false;
                        }

                        // var promises = []

                        _context2.next = 12;
                        break;

                    case 8:
                        _context2.prev = 8;
                        _context2.t0 = _context2['catch'](4);
                        _didIteratorError2 = true;
                        _iteratorError2 = _context2.t0;

                    case 12:
                        _context2.prev = 12;
                        _context2.prev = 13;

                        if (!_iteratorNormalCompletion2 && _iterator2.return) {
                            _iterator2.return();
                        }

                    case 15:
                        _context2.prev = 15;

                        if (!_didIteratorError2) {
                            _context2.next = 18;
                            break;
                        }

                        throw _iteratorError2;

                    case 18:
                        return _context2.finish(15);

                    case 19:
                        return _context2.finish(12);

                    case 20:
                        lastFrame = Date.now();

                    case 21:
                        if (!true) {
                            _context2.next = 63;
                            break;
                        }

                        pending = network.filter(function (k) {
                            return !info[k.name].done;
                        });
                        ready = pending.filter(function (k) {
                            return Object.values(k.deps).every(function (e) {
                                return info[e].done;
                            });
                        });

                        if (!(ready.length == 0)) {
                            _context2.next = 28;
                            break;
                        }

                        if (!(pending.length > 0)) {
                            _context2.next = 27;
                            break;
                        }

                        throw new Error("Finished with layers still pending.");

                    case 27:
                        return _context2.abrupt('break', 63);

                    case 28:
                        _iteratorNormalCompletion3 = true;
                        _didIteratorError3 = false;
                        _iteratorError3 = undefined;
                        _context2.prev = 31;
                        _iterator3 = ready[Symbol.iterator]();

                    case 33:
                        if (_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done) {
                            _context2.next = 47;
                            break;
                        }

                        layer = _step3.value;

                        // promises.push(new Promise(resolve => info[layer.name].run(options, resolve)))
                        info[layer.name].run(options);
                        info[layer.name].done = true;

                        _context2.next = 44;
                        break;

                    case 44:
                        _iteratorNormalCompletion3 = true;
                        _context2.next = 33;
                        break;

                    case 47:
                        _context2.next = 53;
                        break;

                    case 49:
                        _context2.prev = 49;
                        _context2.t1 = _context2['catch'](31);
                        _didIteratorError3 = true;
                        _iteratorError3 = _context2.t1;

                    case 53:
                        _context2.prev = 53;
                        _context2.prev = 54;

                        if (!_iteratorNormalCompletion3 && _iterator3.return) {
                            _iterator3.return();
                        }

                    case 56:
                        _context2.prev = 56;

                        if (!_didIteratorError3) {
                            _context2.next = 59;
                            break;
                        }

                        throw _iteratorError3;

                    case 59:
                        return _context2.finish(56);

                    case 60:
                        return _context2.finish(53);

                    case 61:
                        _context2.next = 21;
                        break;

                    case 63:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this, [
            [4, 8, 12, 20],
            [13, , 15, 19],
            [31, 49, 53, 61],
            [54, , 56, 60]
        ]);
    }));

    return function myrun(_x4, _x5, _x6) {
        return _ref2.apply(this, arguments);
    };
}();

var destroy = function () {
    var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(gl, compiled) {
        var network, info, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, layer;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        network = compiled.network, info = compiled.info;


                        console.time('destroying network');
                        _iteratorNormalCompletion4 = true;
                        _didIteratorError4 = false;
                        _iteratorError4 = undefined;
                        _context3.prev = 5;
                        for (_iterator4 = network[Symbol.iterator](); !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                            layer = _step4.value;

                            info[layer.name].destroy();
                        }
                        _context3.next = 13;
                        break;

                    case 9:
                        _context3.prev = 9;
                        _context3.t0 = _context3['catch'](5);
                        _didIteratorError4 = true;
                        _iteratorError4 = _context3.t0;

                    case 13:
                        _context3.prev = 13;
                        _context3.prev = 14;

                        if (!_iteratorNormalCompletion4 && _iterator4.return) {
                            _iterator4.return();
                        }

                    case 16:
                        _context3.prev = 16;

                        if (!_didIteratorError4) {
                            _context3.next = 19;
                            break;
                        }

                        throw _iteratorError4;

                    case 19:
                        return _context3.finish(16);

                    case 20:
                        return _context3.finish(13);

                    case 21:
                        console.timeEnd('destroying network');

                    case 22:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this, [
            [5, 9, 13, 21],
            [14, , 16, 20]
        ]);
    }));

    return function destroy(_x7, _x8) {
        return _ref3.apply(this, arguments);
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