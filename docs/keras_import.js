'use strict';

function import_keras_network(keras_model, keras_model_meta, buffer) {
    var network = [];

    function getWeight(name) {
        var w = keras_model_meta.find(function (k) {
            return k.weight_name == name;
        });
        console.assert(w.type == 'float32');
        var data = new Float32Array(buffer, w.offset, w.length);
        var array = ndarray(data, w.shape);
        return array;
    }

    // console.log(ndshow(getWeight("batchnormalization_14_beta:0")))

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        var _loop2 = function _loop2() {
            var layer = _step.value;
            inbound = [];


            function W(name) {
                return getWeight(layer.name + '_' + name);
            }

            if (layer.inbound_nodes.length) layer.inbound_nodes[0].forEach(function (node) {
                return inbound.push(node[0]);
            });

            if (layer.class_name == 'Convolution2D') {
                console.assert(layer.config.W_regularizer == null);
                console.assert(layer.config.b_regularizer == null);
                console.assert(layer.config.W_constraint == null);
                console.assert(layer.config.b_constraint == null);
                console.assert(layer.config.dim_ordering == 'tf');

                if (ndops.norm1(W('b:0')) < 1e-5) {
                    network.push({
                        name: layer.name,
                        type: 'Convolve2D',
                        subsample: layer.config.subsample,
                        border_mode: layer.config.border_mode,
                        kernel: W('W:0'),
                        deps: {
                            image: inbound[0]
                        },
                        _keras: layer
                    });
                } else {
                    network.push({
                        name: layer.name,
                        type: 'BiasConvolve2D',
                        subsample: layer.config.subsample,
                        border_mode: layer.config.border_mode,
                        kernel: W('W:0'),
                        bias: W('b:0'),
                        deps: {
                            image: inbound[0]
                        },
                        _keras: layer
                    });
                }
            } else if (layer.class_name == 'Deconvolution2D') {
                console.assert(ndops.norm1(W('b:0')) < 1e-5); // bias must be zero
                console.assert(layer.config.dim_ordering == 'tf');

                network.push({
                    name: layer.name,
                    type: 'Deconvolve2D',
                    kernel: W('W:0'),
                    subsample: layer.config.subsample,
                    padding: [2, 2],
                    deps: {
                        image: inbound[0]
                    },
                    _keras: layer
                });
            } else if (layer.class_name == 'MaxPooling2D') {
                console.assert(layer.config.dim_ordering == 'tf');
                network.push({
                    name: layer.name,
                    type: 'MaxPooling2D',
                    border_mode: layer.config.border_mode,
                    pool_size: layer.config.pool_size,
                    strides: layer.config.strides,
                    deps: { image: inbound[0] },
                    _keras: layer
                });
            } else if (layer.class_name == 'AveragePooling2D') {
                console.assert(layer.config.dim_ordering == 'tf');
                network.push({
                    name: layer.name,
                    type: 'AveragePooling2D',
                    border_mode: layer.config.border_mode,
                    pool_size: layer.config.pool_size,
                    strides: layer.config.strides,
                    deps: { image: inbound[0] },
                    _keras: layer
                });
            } else if (layer.class_name == 'ZeroPadding2D') {
                network.push({
                    name: layer.name,
                    type: 'ZeroPadding2D',
                    deps: { image: inbound[0] },
                    padding: layer.config.padding,
                    _keras: layer
                });
            } else if (layer.class_name == "Flatten") {
                network.push( {
                    name: layer.name,
                    type: 'Flatten',
                    deps: { image: inbound[0] },
                    _keras: layer
                });
            } else if (layer.class_name == 'Dense') {
                // not really sure about this one,
                // console.assert(ndops.norm1(W('b:0')) < 1e-5)

                network.push( {
                    name: layer.name,
                    type: 'ChannelFullyConnected',
                    deps: { image: inbound[0] },
                    bias: W('b:0'),
                    weights: W('W:0'),
                    _keras: layer
                });
            } else if (layer.class_name == 'Merge') {
                console.assert(inbound.length == 2);
                if (layer.config.mode == "sum") {
                    network.push({
                        name: layer.name,
                        type: 'Sum',
                        deps: {
                            a: inbound[0],
                            b: inbound[1]
                        },
                        _keras: layer
                    });
                } else if (layer.config.mode == "concat" && layer.config.concat_axis === 3) {
                    network.push({
                        name: layer.name,
                        type: 'ConcatChannel',
                        deps: {
                            a: inbound[0],
                            b: inbound[1]
                        },
                        _keras: layer
                    });
                } else {
                    throw new Error("unsupported merge mode");
                }
            } else if (layer.class_name == 'BatchNormalization') {
                console.assert(layer.config.axis == 3);
                if (layer.config.mode == 2) {
                    // feature-wise normalization, using per-batch statistics
                    network.push({
                        name: layer.name + '_mean',
                        type: 'ComputeMean',
                        deps: { image: inbound[0] }
                    }, {
                        name: layer.name + '_residual',
                        type: 'SquaredResidual',
                        deps: {
                            image: inbound[0],
                            mean: layer.name + '_mean'
                        }
                    }, {
                        name: layer.name + '_variance',
                        type: 'ComputeMean',
                        deps: { image: layer.name + '_residual' }
                    }, {
                        name: layer.name,
                        type: 'InstanceNormalize',
                        deps: {
                            image: inbound[0],
                            mean: layer.name + '_mean',
                            variance: layer.name + '_variance'
                        }//,
                        //beta: W('beta:0'),
                        // gamma: W('gamma:0')
                    });
                } else if (layer.config.mode == 0) {
                    network.push({
                        name: layer.name,
                        type: 'BatchNormalize',
                        epsilon: layer.config.epsilon,
                        running_mean: W('running_mean:0'),
                        running_var: W('running_var:0'),
                        deps: { image: inbound[0] }
                    });
                } else {
                    throw new Error('unsupported batch normalization mode');
                }
            } else if (layer.class_name == 'Activation') {
                network.push({
                    name: layer.name,
                    type: 'Activation',
                    activation: layer.config.activation,
                    deps: {
                        image: inbound[0]
                    },
                    _keras: layer
                });
            } else if (layer.class_name == 'InputLayer') {
                network.push({
                    name: layer.name,
                    type: 'InputLayer',
                    deps: {},
                    _keras: layer
                });
            } else if (layer.class_name == 'Dropout' || layer.class_name == 'Flatten') {
                network.push({
                    name: layer.name,
                    type: 'Identity',
                    deps: { image: inbound[0] },
                    _keras: layer
                });
            } else if (layer.class_name == "Swap") {
                network.push({
                    name: layer.name,
                    type: 'Swap',
                    deps: { image: inbound[0] },
                    _keras: layer
                });
            } else if (layer.class_name == "GlobalAveragePooling2D") {
                network.push({
                    name: layer.name,
                    type: 'ComputeMean',
                    deps: { image: inbound[0] },
                    _keras: layer
                });
            } else {
                console.error(layer, keras_model_meta.filter(function (k) {
                    return k.layer_name == layer.name;
                }));
            }
        };

        for (var _iterator = keras_model.config.layers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var inbound;

            _loop2();
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    function rename_deps(oldName, newName) {
        // console.log('renaming', oldName, newName)
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
            for (var _iterator2 = network[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var layer = _step2.value;

                for (var dep in layer.deps) {
                    if (layer.deps[dep] == oldName) layer.deps[dep] = newName;
                }
            }
        } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                }
            } finally {
                if (_didIteratorError2) {
                    throw _iteratorError2;
                }
            }
        }
    }
    // expand inline activations
    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = network[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var _layer2 = _step3.value;

            if (_layer2.type == 'Activation') continue;
            if (!_layer2._keras) continue;
            var activation = _layer2._keras.config.activation;
            if (!activation || activation == 'linear') continue;
            // delete layer._keras.config.activation;

            rename_deps(_layer2.name, _layer2.name + '_' + activation);
            network.splice(network.indexOf(_layer2) + 1, 0, {
                type: 'Activation',
                name: _layer2.name + '_' + activation,
                deps: { image: _layer2.name },
                activation: activation
            });
        }

        // expand softmax activations
    } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
            }
        } finally {
            if (_didIteratorError3) {
                throw _iteratorError3;
            }
        }
    }

    for (var i = 0; i < network.length; i++) {
        var layer = network[i];

        if (layer.type != 'Activation') continue;
        if (layer.activation != 'softmax') continue;
        network.splice(i, 1, {
            type: 'ExpSum',
            name: layer.name + '_expsum',
            deps: { image: layer.deps.image }
        }, {
            type: 'Softmax',
            name: layer.name,
            deps: { image: layer.deps.image, helper: layer.name + '_expsum' }
        });
        i--;
    }

    // elide activations
    // for(let layer of network){

    var _loop = function _loop() {
        var layer = network[i];

        if (layer.type != 'Activation') return 'continue';
        // make sure nothing else depends on its input
        if (network.some(function (k) {
            return k !== layer && Object.values(k.deps).includes(layer.deps.image);
        })) {
            console.log('stuff depends', layer);
            return 'continue';
        }
        input = network.find(function (k) {
            return k.name == layer.deps.image;
        });
        // make sure input does not already have an attached activation

        if (input.activation) {
            console.log('already has input activation', layer);
            return 'continue';
        }

        // remove this thing
        network.splice(i, 1);
        i--;
        // rename the input and set the activation
        new_name = input.name + '+' + layer.name;

        rename_deps(layer.name, new_name);
        input.name = new_name;
        input.activation = layer.activation;
    };

    for (var i = 0; i < network.length; i++) {
        var input;
        var new_name;

        var _ret = _loop();

        if (_ret === 'continue') continue;
    }

    // remove dropout and stuff
    for (var i = 0; i < network.length; i++) {
        var _layer = network[i];
        if (_layer.type != 'Identity') continue;
        network.splice(i, 1);
        i--;
        rename_deps(_layer.name, _layer.deps.image);
    }

    return network;
}